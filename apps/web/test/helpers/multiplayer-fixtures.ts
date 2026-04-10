import type { MultiplayerRoomReplayData, MultiplayerRoomState } from "@typ-nique/types";

export function createMultiplayerRoomStateFixture(overrides: Partial<MultiplayerRoomState> = {}): MultiplayerRoomState {
  return {
    id: "room-1",
    roomCode: "ABC123",
    roomVersion: 3,
    mode: "live",
    status: "completed",
    createdAt: "2026-04-10T12:00:00.000Z",
    startedAt: "2026-04-10T12:00:05.000Z",
    raceStartsAt: "2026-04-10T12:00:05.000Z",
    countdownEndsAt: null,
    countdownRemainingMs: 0,
    endedAt: "2026-04-10T12:05:00.000Z",
    maxPlayers: 8,
    durationMinutes: 2,
    startedRoundIndex: 1,
    isLocked: true,
    localPlayerId: "player-1",
    localSessionId: "session-1",
    canStart: false,
    players: [],
    standings: [],
    finalPlacements: [],
    ...overrides
  };
}

export function createMultiplayerReplayFixture(overrides: Partial<MultiplayerRoomReplayData> = {}): MultiplayerRoomReplayData {
  return {
    room: createMultiplayerRoomStateFixture(),
    players: [
      {
        playerId: "player-1",
        gameSessionId: "session-1",
        displayName: "Ada",
        finalPlace: 1,
        connectionStatus: "connected",
        score: 540,
        solvedCount: 5,
        attemptedCount: 6,
        accuracy: 5 / 6,
        completedRounds: 5,
        currentRoundNumber: 6,
        durationMs: 175000,
        finishedAt: "2026-04-10T12:04:40.000Z",
        rounds: [
          {
            roundId: "round-1",
            position: 1,
            challengeId: "challenge-1",
            challengeTitle: "Aligned Sum",
            challengeSlug: "aligned-sum",
            difficulty: "easy",
            verdict: "correct",
            matchTier: "normalized",
            scoreAwarded: 120,
            feedback: "Accepted."
          }
        ]
      }
    ],
    diagnostics: {
      generatedAt: "2026-04-10T12:06:00.000Z",
      roomId: "room-1",
      roomCode: "ABC123",
      roomVersion: 3,
      roomStatus: "completed",
      raceStartsAt: "2026-04-10T12:00:05.000Z",
      countdownEndsAt: null,
      finishedAt: "2026-04-10T12:05:00.000Z",
      playerCount: 2,
      diagnosticsPlayers: [
        {
          playerId: "player-1",
          displayName: "Ada",
          gameSessionId: "session-1",
          connectionStatus: "connected",
          sessionStatus: "completed",
          joinedAt: "2026-04-10T12:00:00.000Z",
          readyAt: "2026-04-10T12:00:02.000Z",
          leftAt: null,
          finishedAt: "2026-04-10T12:04:40.000Z",
          lastHeartbeatAt: "2026-04-10T12:04:39.000Z",
          finalPlace: 1,
          score: 540,
          solvedCount: 5,
          attemptedCount: 6,
          completedRounds: 5,
          currentRoundNumber: 6
        }
      ]
    },
    ...overrides
  };
}
