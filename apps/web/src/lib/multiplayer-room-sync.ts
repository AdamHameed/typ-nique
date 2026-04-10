import type { MultiplayerGatewayServerEvent } from "@typ-nique/types";

export interface RoomEventCursor {
  roomId: string | null;
  roomVersion: number;
  eventSequence: number;
}

export function createInitialRoomEventCursor(): RoomEventCursor {
  return {
    roomId: null,
    roomVersion: 0,
    eventSequence: 0
  };
}

export function shouldAcceptRoomEvent(
  cursor: RoomEventCursor,
  event: MultiplayerGatewayServerEvent<unknown>
) {
  if (cursor.roomId && event.roomId && event.roomId !== cursor.roomId) {
    return false;
  }

  if (event.roomVersion < cursor.roomVersion) {
    return false;
  }

  if (event.roomVersion === cursor.roomVersion && event.eventSequence <= cursor.eventSequence) {
    return false;
  }

  return true;
}

export function commitRoomEvent(
  cursor: RoomEventCursor,
  event: MultiplayerGatewayServerEvent<unknown>
): RoomEventCursor {
  if (event.roomVersion > cursor.roomVersion) {
    return {
      roomId: event.roomId,
      roomVersion: event.roomVersion,
      eventSequence: event.eventSequence
    };
  }

  return {
    roomId: event.roomId ?? cursor.roomId,
    roomVersion: cursor.roomVersion,
    eventSequence: event.eventSequence
  };
}
