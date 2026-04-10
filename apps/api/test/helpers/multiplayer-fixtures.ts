import type { MultiplayerRoomReplayData, MultiplayerRoomState } from "@typ-nique/types";

export function createMultiplayerRoomStateFixture(overrides: Partial<MultiplayerRoomState> = {}): MultiplayerRoomState {
  return {
    id: "room-1",
    roomCode: "ABC123",
    roomVersion: 2,
    mode: "live",
    status: "pending",
    createdAt: "2026-04-10T12:00:00.000Z",
    startedAt: null,
    raceStartsAt: null,
    countdownEndsAt: null,
    countdownRemainingMs: 0,
    endedAt: null,
    maxPlayers: 8,
    durationMinutes: 2,
    startedRoundIndex: 0,
    isLocked: false,
    localPlayerId: "player-1",
    localSessionId: "session-1",
    canStart: false,
    players: [],
    standings: [],
    finalPlacements: [],
    ...overrides
  };
}

export function createMultiplayerReplayFixture(
  overrides: Partial<MultiplayerRoomReplayData> = {}
): MultiplayerRoomReplayData {
  return {
    room: createMultiplayerRoomStateFixture({
      status: "completed",
      roomVersion: 3,
      startedAt: "2026-04-10T12:00:05.000Z",
      raceStartsAt: "2026-04-10T12:00:05.000Z",
      endedAt: "2026-04-10T12:05:00.000Z",
      startedRoundIndex: 1,
      isLocked: true
    }),
    players: [],
    diagnostics: null,
    ...overrides
  };
}
