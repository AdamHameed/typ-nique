import type { FastifyInstance } from "fastify";
import {
  createMultiplayerRoomSchema,
  multiplayerMatchParamsSchema,
  multiplayerReadyMutationSchema,
  multiplayerResultsQuerySchema,
  multiplayerRoomCodeParamsSchema,
  multiplayerVersionSchema
} from "@typ-nique/validation";
import { ensurePlayerSession, resolveAuthContext } from "../lib/auth.js";
import { env } from "../lib/env.js";
import {
  createMultiplayerRoom,
  getMultiplayerRoomByCode,
  getMultiplayerRoomPreviewByCode,
  getMultiplayerRoomReplayData,
  getMultiplayerRoom,
  joinMultiplayerRoom,
  joinMultiplayerRoomByCode,
  leaveMultiplayerRoom,
  resetMultiplayerRoomToLobby,
  setMultiplayerReadiness,
  startMultiplayerCountdown
} from "../services/multiplayer-service.js";

export async function multiplayerRoutes(app: FastifyInstance) {
  app.post("/api/v1/multiplayer/rooms", async (request, reply) => {
    const body = createMultiplayerRoomSchema.parse(request.body);
    const auth = await resolveAuthContext(request);
    const playerSessionId = await ensurePlayerSession(request, reply, auth);

    try {
      const room = await createMultiplayerRoom(body, {
        ...auth,
        playerSessionId
      });

      return reply.code(201).send({ data: room });
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Room creation failed." });
    }
  });

  app.get("/api/v1/multiplayer/rooms/:matchId", async (request, reply) => {
    const params = multiplayerMatchParamsSchema.parse(request.params);
    const auth = await resolveAuthContext(request);

    try {
      const room = await getMultiplayerRoom(params.matchId, auth);
      return { data: room };
    } catch (error) {
      return mapMultiplayerError(reply, error);
    }
  });

  app.get("/api/v1/multiplayer/rooms/:matchId/snapshot", async (request, reply) => {
    const params = multiplayerMatchParamsSchema.parse(request.params);
    const auth = await resolveAuthContext(request);

    try {
      const room = await getMultiplayerRoom(params.matchId, auth);
      return { data: room };
    } catch (error) {
      return mapMultiplayerError(reply, error);
    }
  });

  app.get("/api/v1/multiplayer/rooms/code/:roomCode", async (request, reply) => {
    const params = multiplayerRoomCodeParamsSchema.parse(request.params);

    try {
      const room = await getMultiplayerRoomPreviewByCode(params.roomCode);
      return { data: room };
    } catch (error) {
      return mapMultiplayerError(reply, error);
    }
  });

  app.get("/api/v1/multiplayer/rooms/code/:roomCode/snapshot", async (request, reply) => {
    const params = multiplayerRoomCodeParamsSchema.parse(request.params);
    const auth = await resolveAuthContext(request);

    try {
      const room = await getMultiplayerRoomByCode(params.roomCode, auth);
      return { data: room };
    } catch (error) {
      return mapMultiplayerError(reply, error);
    }
  });

  app.post("/api/v1/multiplayer/rooms/:matchId/join", async (request, reply) => {
    const params = multiplayerMatchParamsSchema.parse(request.params);
    const body = multiplayerVersionSchema.parse(request.body ?? {});
    const auth = await resolveAuthContext(request);
    const playerSessionId = await ensurePlayerSession(request, reply, auth);

    try {
      const room = await joinMultiplayerRoom(params.matchId, {
        ...auth,
        playerSessionId
      }, {
        expectedRoomVersion: body.roomVersion
      });

      return { data: room };
    } catch (error) {
      return mapMultiplayerError(reply, error);
    }
  });

  app.post("/api/v1/multiplayer/rooms/code/:roomCode/join", async (request, reply) => {
    const params = multiplayerRoomCodeParamsSchema.parse(request.params);
    const body = multiplayerVersionSchema.parse(request.body ?? {});
    const auth = await resolveAuthContext(request);
    const playerSessionId = await ensurePlayerSession(request, reply, auth);

    try {
      const room = await joinMultiplayerRoomByCode(params.roomCode, {
        ...auth,
        playerSessionId
      }, {
        expectedRoomVersion: body.roomVersion
      });

      return { data: room };
    } catch (error) {
      return mapMultiplayerError(reply, error);
    }
  });

  app.post("/api/v1/multiplayer/rooms/:matchId/leave", async (request, reply) => {
    const params = multiplayerMatchParamsSchema.parse(request.params);
    const body = multiplayerVersionSchema.parse(request.body ?? {});
    const auth = await resolveAuthContext(request);

    try {
      const room = await leaveMultiplayerRoom(params.matchId, auth, {
        expectedRoomVersion: body.roomVersion
      });
      return { data: room };
    } catch (error) {
      return mapMultiplayerError(reply, error);
    }
  });

  app.post("/api/v1/multiplayer/rooms/:matchId/ready", async (request, reply) => {
    const params = multiplayerMatchParamsSchema.parse(request.params);
    const body = multiplayerReadyMutationSchema.parse(request.body);
    const auth = await resolveAuthContext(request);

    try {
      const room = await setMultiplayerReadiness(params.matchId, auth, body.ready, {
        expectedRoomVersion: body.roomVersion
      });
      return { data: room };
    } catch (error) {
      return mapMultiplayerError(reply, error);
    }
  });

  app.post("/api/v1/multiplayer/rooms/:matchId/unready", async (request, reply) => {
    const params = multiplayerMatchParamsSchema.parse(request.params);
    const body = multiplayerVersionSchema.parse(request.body ?? {});
    const auth = await resolveAuthContext(request);

    try {
      const room = await setMultiplayerReadiness(params.matchId, auth, false, {
        expectedRoomVersion: body.roomVersion
      });
      return { data: room };
    } catch (error) {
      return mapMultiplayerError(reply, error);
    }
  });

  app.post("/api/v1/multiplayer/rooms/:matchId/start", async (request, reply) => {
    const params = multiplayerMatchParamsSchema.parse(request.params);
    const body = multiplayerVersionSchema.parse(request.body ?? {});
    const auth = await resolveAuthContext(request);

    try {
      const room = await startMultiplayerCountdown(params.matchId, auth, {
        expectedRoomVersion: body.roomVersion
      });
      return { data: room };
    } catch (error) {
      return mapMultiplayerError(reply, error);
    }
  });

  app.post("/api/v1/multiplayer/rooms/:matchId/reset", async (request, reply) => {
    const params = multiplayerMatchParamsSchema.parse(request.params);
    const body = multiplayerVersionSchema.parse(request.body ?? {});
    const auth = await resolveAuthContext(request);

    try {
      const room = await resetMultiplayerRoomToLobby(params.matchId, auth, {
        expectedRoomVersion: body.roomVersion
      });
      return { data: room };
    } catch (error) {
      return mapMultiplayerError(reply, error);
    }
  });

  app.get("/api/v1/multiplayer/rooms/:matchId/results", async (request, reply) => {
    const params = multiplayerMatchParamsSchema.parse(request.params);
    const query = multiplayerResultsQuerySchema.parse(request.query ?? {});
    const auth = await resolveAuthContext(request);

    try {
      const data = await getMultiplayerRoomReplayData(params.matchId, auth, {
        includeDiagnostics: env.ENABLE_MULTIPLAYER_DIAGNOSTICS && query.includeDiagnostics && auth.authenticated
      });
      return { data };
    } catch (error) {
      return mapMultiplayerError(reply, error);
    }
  });
}

function mapMultiplayerError(reply: { code: (statusCode: number) => { send: (body: unknown) => unknown } }, error: unknown) {
  const message = error instanceof Error ? error.message : "Multiplayer request failed.";

  if (message === "No MultiplayerMatch found") {
    return reply.code(404).send({ error: "Room not found." });
  }

  if (message === "Room not accessible.") {
    return reply.code(403).send({ error: message });
  }

  return reply.code(400).send({ error: message });
}
