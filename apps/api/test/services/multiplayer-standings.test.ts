import { describe, expect, it } from "vitest";
import type { MultiplayerPlayerView } from "@typ-nique/types";
import { assignFinalPlaces, buildStandingsEntries } from "../../src/services/multiplayer-standings.js";

function buildPlayer(overrides: Partial<MultiplayerPlayerView> & Pick<MultiplayerPlayerView, "playerId" | "displayName">): MultiplayerPlayerView {
  return {
    playerId: overrides.playerId,
    gameSessionId: overrides.gameSessionId ?? null,
    userId: overrides.userId ?? null,
    playerSessionId: overrides.playerSessionId ?? null,
    displayName: overrides.displayName,
    joinedAt: overrides.joinedAt ?? "2026-04-10T10:00:00.000Z",
    readyAt: overrides.readyAt ?? null,
    leftAt: overrides.leftAt ?? null,
    finishedAt: overrides.finishedAt ?? null,
    isHost: overrides.isHost ?? false,
    isReady: overrides.isReady ?? true,
    status: overrides.status ?? "active",
    finalPlace: overrides.finalPlace ?? null,
    score: overrides.score ?? 0,
    solvedCount: overrides.solvedCount ?? 0,
    attemptedCount: overrides.attemptedCount ?? 0,
    accuracy: overrides.accuracy ?? 0,
    completedRounds: overrides.completedRounds ?? 0,
    currentRoundNumber: overrides.currentRoundNumber ?? 0
  };
}

describe("multiplayer standings", () => {
  it("prefers solved rounds, then score, then earlier completion time", () => {
    const standings = buildStandingsEntries([
      buildPlayer({
        playerId: "late-finisher",
        displayName: "Late",
        completedRounds: 4,
        solvedCount: 4,
        score: 420,
        finishedAt: "2026-04-10T10:05:00.000Z"
      }),
      buildPlayer({
        playerId: "high-score",
        displayName: "Score",
        completedRounds: 4,
        solvedCount: 4,
        score: 430
      }),
      buildPlayer({
        playerId: "early-finisher",
        displayName: "Early",
        completedRounds: 4,
        solvedCount: 4,
        score: 420,
        finishedAt: "2026-04-10T10:04:00.000Z"
      }),
      buildPlayer({
        playerId: "fewer-rounds",
        displayName: "Rounds",
        completedRounds: 3,
        solvedCount: 3,
        score: 999
      })
    ]);

    expect(standings.map((entry) => entry.playerId)).toEqual([
      "high-score",
      "early-finisher",
      "late-finisher",
      "fewer-rounds"
    ]);
    expect(standings.map((entry) => entry.rank)).toEqual([1, 2, 3, 4]);
  });

  it("keeps finalized placements ahead of live standings metrics", () => {
    const standings = buildStandingsEntries([
      buildPlayer({
        playerId: "placed-second",
        displayName: "Second",
        finalPlace: 2,
        completedRounds: 10,
        solvedCount: 10,
        score: 999
      }),
      buildPlayer({
        playerId: "placed-first",
        displayName: "First",
        finalPlace: 1,
        completedRounds: 1,
        solvedCount: 1,
        score: 1
      }),
      buildPlayer({
        playerId: "unplaced",
        displayName: "Live",
        completedRounds: 11,
        solvedCount: 11,
        score: 1000
      })
    ]);

    expect(standings.map((entry) => entry.playerId)).toEqual([
      "placed-first",
      "placed-second",
      "unplaced"
    ]);
  });

  it("uses joinedAt then playerId as deterministic fallback tiebreakers", () => {
    const standings = buildStandingsEntries([
      buildPlayer({
        playerId: "b-player",
        displayName: "B",
        joinedAt: "2026-04-10T10:00:00.000Z",
        completedRounds: 2,
        solvedCount: 2,
        score: 200
      }),
      buildPlayer({
        playerId: "a-player",
        displayName: "A",
        joinedAt: "2026-04-10T10:00:00.000Z",
        completedRounds: 2,
        solvedCount: 2,
        score: 200
      })
    ]);

    expect(standings.map((entry) => entry.playerId)).toEqual(["a-player", "b-player"]);
  });

  it("assigns final places deterministically from the same metrics", () => {
    const placements = assignFinalPlaces([
      buildPlayer({
        playerId: "player-3",
        displayName: "Three",
        joinedAt: "2026-04-10T10:00:02.000Z",
        completedRounds: 5,
        solvedCount: 5,
        score: 500,
        finishedAt: "2026-04-10T10:09:00.000Z"
      }),
      buildPlayer({
        playerId: "player-1",
        displayName: "One",
        joinedAt: "2026-04-10T10:00:00.000Z",
        completedRounds: 5,
        solvedCount: 5,
        score: 500,
        finishedAt: "2026-04-10T10:08:00.000Z"
      }),
      buildPlayer({
        playerId: "player-2",
        displayName: "Two",
        joinedAt: "2026-04-10T10:00:01.000Z",
        completedRounds: 5,
        solvedCount: 5,
        score: 500,
        finishedAt: "2026-04-10T10:08:00.000Z"
      })
    ]);

    expect(placements).toEqual([
      { playerId: "player-1", finalPlace: 1 },
      { playerId: "player-2", finalPlace: 2 },
      { playerId: "player-3", finalPlace: 3 }
    ]);
  });

  it("does not treat skipped rounds as solved in live standings", () => {
    const standings = buildStandingsEntries([
      buildPlayer({
        playerId: "skip-heavy",
        displayName: "Skip",
        completedRounds: 3,
        solvedCount: 1,
        score: 200
      }),
      buildPlayer({
        playerId: "steady",
        displayName: "Steady",
        completedRounds: 2,
        solvedCount: 2,
        score: 180
      })
    ]);

    expect(standings.map((entry) => entry.playerId)).toEqual(["steady", "skip-heavy"]);
  });
});
