import type { MultiplayerGatewayServerEvent, MultiplayerGatewayServerEventType } from "@typ-nique/types";
import type WebSocket from "ws";

export interface LiveRoomConnection {
  id: string;
  socket: WebSocket;
  roomId: string | null;
  actor: {
    userId: string | null;
    playerSessionId: string | null;
  };
}

const roomConnections = new Map<string, Map<string, LiveRoomConnection>>();
const roomSequences = new Map<string, number>();
const allConnections = new Map<string, LiveRoomConnection>();
let directSequence = 0;

export function registerLiveConnection(connection: LiveRoomConnection) {
  allConnections.set(connection.id, connection);
}

export function attachConnectionToRoom(connectionId: string, roomId: string) {
  const connection = allConnections.get(connectionId);

  if (!connection) {
    return;
  }

  if (connection.roomId && connection.roomId !== roomId) {
    detachConnectionFromRoom(connection.id);
  }

  connection.roomId = roomId;

  let connections = roomConnections.get(roomId);

  if (!connections) {
    connections = new Map();
    roomConnections.set(roomId, connections);
  }

  connections.set(connection.id, connection);
}

export function detachConnectionFromRoom(connectionId: string) {
  const connection = allConnections.get(connectionId);

  if (!connection?.roomId) {
    return;
  }

  const connections = roomConnections.get(connection.roomId);
  connections?.delete(connection.id);

  if (connections && connections.size === 0) {
    roomConnections.delete(connection.roomId);
  }

  connection.roomId = null;
}

export function unregisterLiveConnection(connectionId: string) {
  detachConnectionFromRoom(connectionId);
  allConnections.delete(connectionId);
}

export function getLiveConnection(connectionId: string) {
  return allConnections.get(connectionId) ?? null;
}

export function getRoomConnectionCount(roomId: string) {
  return roomConnections.get(roomId)?.size ?? 0;
}

export function publishRoomEvent<TPayload>(
  roomId: string,
  roomVersion: number,
  type: MultiplayerGatewayServerEventType,
  payload: TPayload
) {
  const nextSequence = (roomSequences.get(roomId) ?? 0) + 1;
  roomSequences.set(roomId, nextSequence);

  const envelope: MultiplayerGatewayServerEvent<TPayload> = {
    type,
    roomId,
    roomVersion,
    eventSequence: nextSequence,
    occurredAt: new Date().toISOString(),
    payload
  };

  const raw = JSON.stringify(envelope);
  const connections = roomConnections.get(roomId);

  if (!connections) {
    return envelope;
  }

  for (const connection of connections.values()) {
    if (connection.socket.readyState === connection.socket.OPEN) {
      connection.socket.send(raw);
    }
  }

  return envelope;
}

export function sendDirectEvent<TPayload>(
  socket: WebSocket,
  type: MultiplayerGatewayServerEventType,
  payload: TPayload,
  options?: { roomId?: string | null; roomVersion?: number; eventSequence?: number }
) {
  const envelope: MultiplayerGatewayServerEvent<TPayload> = {
    type,
    roomId: options?.roomId ?? null,
    roomVersion: options?.roomVersion ?? 0,
    eventSequence: options?.eventSequence ?? ++directSequence,
    occurredAt: new Date().toISOString(),
    payload
  };

  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(envelope));
  }

  return envelope;
}
