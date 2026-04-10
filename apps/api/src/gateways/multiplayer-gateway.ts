import type { FastifyInstance } from "fastify";
import type { IncomingMessage } from "node:http";
import type { MultiplayerRoomSnapshotEventPayload } from "@typ-nique/types";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { WebSocketServer } from "ws";
import type WebSocket from "ws";
import { buildRateLimitKey, checkRateLimit } from "../lib/rate-limit.js";
import { isAllowedBrowserOrigin } from "../lib/browser-origin.js";
import { env } from "../lib/env.js";
import { logSecurityEvent, sanitizeMultiplayerClientError } from "../lib/security-observability.js";
import { prisma } from "../lib/prisma.js";
import { attachConnectionToRoom, detachConnectionFromRoom, registerLiveConnection, sendDirectEvent, unregisterLiveConnection } from "../lib/multiplayer-live-hub.js";
import { resolveAuthContextFromHeaders } from "../lib/auth.js";
import {
  assertMultiplayerRoomMembership,
  getMultiplayerRoom,
  getMultiplayerRoomByCode,
  leaveMultiplayerRoom,
  setMultiplayerConnectionStatus,
  setMultiplayerReadiness,
  startMultiplayerCountdown,
  touchMultiplayerHeartbeat,
  type MultiplayerActor
} from "../services/multiplayer-service.js";
import { getGameSessionState } from "../services/game-service.js";

const GATEWAY_PATH = "/api/v1/multiplayer/ws";
const HEARTBEAT_TIMEOUT_MS = 45_000;
const HEARTBEAT_SCAN_INTERVAL_MS = 10_000;
const RECONNECT_AUDIT_WINDOW_MS = 60_000;
const RECONNECT_AUDIT_THRESHOLD = 6;

const subscribeSchema = z.object({
  type: z.literal("room.subscribe"),
  roomVersion: z.number().int().nonnegative().optional(),
  payload: z
    .object({
      matchId: z.string().uuid().optional(),
      roomCode: z.string().min(4).max(32).optional()
    })
    .refine((value) => Boolean(value.matchId || value.roomCode), "matchId or roomCode is required.")
});

const readySchema = z.object({
  type: z.literal("player.ready"),
  roomVersion: z.number().int().nonnegative().optional(),
  payload: z.object({}).optional()
});

const unreadySchema = z.object({
  type: z.literal("player.unready"),
  roomVersion: z.number().int().nonnegative().optional(),
  payload: z.object({}).optional()
});

const leaveSchema = z.object({
  type: z.literal("room.leave"),
  roomVersion: z.number().int().nonnegative().optional(),
  payload: z.object({}).optional()
});

const heartbeatSchema = z.object({
  type: z.literal("player.heartbeat"),
  roomVersion: z.number().int().nonnegative().optional(),
  payload: z.object({}).optional()
});

const countdownSchema = z.object({
  type: z.literal("room.start_countdown"),
  roomVersion: z.number().int().nonnegative().optional(),
  payload: z.object({}).optional()
});

const clientEventSchema = z.union([subscribeSchema, readySchema, unreadySchema, leaveSchema, heartbeatSchema, countdownSchema]);

interface GatewayConnectionContext {
  id: string;
  socket: WebSocket;
  actor: MultiplayerActor;
  roomId: string | null;
  lastHeartbeatAt: number;
}

const gatewayConnections = new Map<string, GatewayConnectionContext>();

export function registerMultiplayerGateway(app: FastifyInstance) {
  const wss = new WebSocketServer({ noServer: true });

  app.server.on("upgrade", async (request, socket, head) => {
    const pathname = extractPathname(request);

    if (pathname !== GATEWAY_PATH) {
      return;
    }

    if (!isAllowedBrowserOrigin(request.headers.origin, env.ALLOWED_BROWSER_ORIGINS)) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    try {
      const actor = await resolveAuthContextFromHeaders(request.headers);

      if (!actor.playerSessionId) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        const connection = createGatewayConnection(ws, actor);
        gatewayConnections.set(connection.id, connection);
        registerLiveConnection({
          id: connection.id,
          socket: ws,
          roomId: null,
          actor
        });

        wireGatewayConnection(connection);

        sendDirectEvent(ws, "connection.ready", {
          connectionId: connection.id,
          heartbeatIntervalMs: HEARTBEAT_TIMEOUT_MS
        });
      });
    } catch {
      socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
      socket.destroy();
    }
  });

  const heartbeatTimer = setInterval(() => {
    void scanForHeartbeatTimeouts();
  }, HEARTBEAT_SCAN_INTERVAL_MS);

  app.addHook("onClose", async () => {
    clearInterval(heartbeatTimer);
    wss.close();
  });
}

function createGatewayConnection(socket: WebSocket, actor: MultiplayerActor): GatewayConnectionContext {
  return {
    id: randomUUID(),
    socket,
    actor,
    roomId: null,
    lastHeartbeatAt: Date.now()
  };
}

function wireGatewayConnection(connection: GatewayConnectionContext) {
  connection.socket.on("message", (raw) => {
    void handleClientMessage(connection, raw.toString());
  });

  connection.socket.on("close", () => {
    void handleConnectionClosed(connection);
  });

  connection.socket.on("error", () => {
    void handleConnectionClosed(connection);
  });
}

async function handleClientMessage(connection: GatewayConnectionContext, raw: string) {
  let message: z.infer<typeof clientEventSchema>;

  try {
    message = clientEventSchema.parse(JSON.parse(raw));
  } catch {
    sendGatewayError(connection.socket, connection.roomId, "Invalid WebSocket payload.");
    return;
  }

  try {
    switch (message.type) {
      case "room.subscribe": {
        const snapshot = message.payload.matchId
          ? await getMultiplayerRoom(message.payload.matchId, connection.actor)
          : await getMultiplayerRoomByCode(message.payload.roomCode!, connection.actor);
        const reconnectPayload = await buildReconnectSnapshotPayload(snapshot, connection.actor);

        auditReconnectBehavior(connection, snapshot.id);
        auditSharedSessionToken(connection, snapshot.id);
        connection.roomId = snapshot.id;
        connection.lastHeartbeatAt = Date.now();
        attachConnectionToRoom(connection.id, snapshot.id);
        await setMultiplayerConnectionStatus(snapshot.id, connection.actor, "CONNECTED");
        sendDirectEvent(connection.socket, "room.snapshot", reconnectPayload, {
          roomId: snapshot.id,
          roomVersion: reconnectPayload.room.roomVersion
        });
        break;
      }

      case "room.leave": {
        const roomId = await requireSubscribedRoom(connection);
        await leaveMultiplayerRoom(roomId, connection.actor, {
          expectedRoomVersion: message.roomVersion
        });
        detachConnectionFromRoom(connection.id);
        connection.roomId = null;
        sendDirectEvent(connection.socket, "room.left", { reason: "player-left" }, { roomId: null, roomVersion: 0 });
        break;
      }

      case "player.ready": {
        const roomId = await requireSubscribedRoom(connection);
        await setMultiplayerReadiness(roomId, connection.actor, true, {
          expectedRoomVersion: message.roomVersion
        });
        break;
      }

      case "player.unready": {
        const roomId = await requireSubscribedRoom(connection);
        await setMultiplayerReadiness(roomId, connection.actor, false, {
          expectedRoomVersion: message.roomVersion
        });
        break;
      }

      case "room.start_countdown": {
        const roomId = await requireSubscribedRoom(connection);
        await startMultiplayerCountdown(roomId, connection.actor, {
          expectedRoomVersion: message.roomVersion
        });
        break;
      }

      case "player.heartbeat": {
        const roomId = await requireSubscribedRoom(connection);
        connection.lastHeartbeatAt = Date.now();
        await touchMultiplayerHeartbeat(roomId, connection.actor);
        sendDirectEvent(connection.socket, "connection.heartbeat_ack", { ok: true }, {
          roomId,
          roomVersion: await getRoomVersion(roomId)
        });
        break;
      }
    }
  } catch (error) {
    logSecurityEvent("multiplayer-gateway-error", {
      roomId: connection.roomId,
      actor: {
        userId: connection.actor.userId,
        playerSessionId: connection.actor.playerSessionId
      },
      error: error instanceof Error ? error.message : "Gateway event failed."
    });
    sendGatewayError(connection.socket, connection.roomId, error instanceof Error ? error.message : "Gateway event failed.");
  }
}

async function handleConnectionClosed(connection: GatewayConnectionContext) {
  if (!gatewayConnections.has(connection.id)) {
    return;
  }

  gatewayConnections.delete(connection.id);
  unregisterLiveConnection(connection.id);

  if (connection.roomId) {
    await setMultiplayerConnectionStatus(connection.roomId, connection.actor, "DISCONNECTED").catch(() => undefined);
  }
}

async function scanForHeartbeatTimeouts() {
  const now = Date.now();

  for (const connection of gatewayConnections.values()) {
    if (!connection.roomId) {
      continue;
    }

    if (now - connection.lastHeartbeatAt <= HEARTBEAT_TIMEOUT_MS) {
      continue;
    }

    logSecurityEvent("multiplayer-heartbeat-timeout", {
      roomId: connection.roomId,
      actor: {
        userId: connection.actor.userId,
        playerSessionId: connection.actor.playerSessionId
      },
      lastHeartbeatAt: new Date(connection.lastHeartbeatAt).toISOString(),
      timeoutMs: HEARTBEAT_TIMEOUT_MS
    });
    await setMultiplayerConnectionStatus(connection.roomId, connection.actor, "DISCONNECTED").catch(() => undefined);
    try {
      connection.socket.close(4000, "Heartbeat timeout");
    } catch {
      // no-op
    }
  }
}

async function requireSubscribedRoom(connection: GatewayConnectionContext) {
  if (!connection.roomId) {
    throw new Error("No room subscription is active.");
  }

  await assertMultiplayerRoomMembership(connection.roomId, connection.actor);
  return connection.roomId;
}

function sendGatewayError(socket: WebSocket, roomId: string | null, message: string) {
  sendDirectEvent(socket, "room.error", { message: sanitizeMultiplayerClientError(message) }, {
    roomId,
    roomVersion: 0
  });
}

async function getRoomVersion(roomId: string) {
  const match = await prisma.multiplayerMatch.findUnique({
    where: { id: roomId },
    select: { roomVersion: true }
  });

  return match?.roomVersion ?? 0;
}

function extractPathname(request: IncomingMessage) {
  const url = new URL(request.url ?? "/", "http://localhost");
  return url.pathname;
}

async function buildReconnectSnapshotPayload(
  room: Awaited<ReturnType<typeof getMultiplayerRoom>>,
  actor: MultiplayerActor
): Promise<MultiplayerRoomSnapshotEventPayload> {
  const sessionState = room.localSessionId
    ? await getGameSessionState(room.localSessionId, actor).catch(() => null)
    : null;

  return {
    reason: "reconnect-sync",
    room,
    sessionState
  };
}

function auditReconnectBehavior(connection: GatewayConnectionContext, roomId: string) {
  const limiter = checkRateLimit(
    buildRateLimitKey(`multiplayer-reconnect:${roomId}`, connection.actor.userId ?? connection.actor.playerSessionId, connection.id),
    RECONNECT_AUDIT_THRESHOLD,
    RECONNECT_AUDIT_WINDOW_MS
  );

  if (!limiter.allowed) {
    logSecurityEvent("multiplayer-unusual-reconnect", {
      roomId,
      actor: {
        userId: connection.actor.userId,
        playerSessionId: connection.actor.playerSessionId
      },
      windowMs: RECONNECT_AUDIT_WINDOW_MS,
      threshold: RECONNECT_AUDIT_THRESHOLD
    });
  }
}

function auditSharedSessionToken(connection: GatewayConnectionContext, roomId: string) {
  const activeMatches = [...gatewayConnections.values()].filter((candidate) => {
    if (candidate.id === connection.id) {
      return false;
    }

    if (!candidate.actor.playerSessionId || !connection.actor.playerSessionId) {
      return false;
    }

    return candidate.actor.playerSessionId === connection.actor.playerSessionId && candidate.roomId !== null;
  });

  if (activeMatches.length === 0) {
    return;
  }

  logSecurityEvent("multiplayer-shared-session-token", {
    roomId,
    playerSessionId: connection.actor.playerSessionId,
    activeConnections: activeMatches.map((candidate) => ({
      connectionId: candidate.id,
      roomId: candidate.roomId
    })),
    newConnectionId: connection.id
  });
}
