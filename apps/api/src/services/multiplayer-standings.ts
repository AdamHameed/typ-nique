import type { MultiplayerPlayerView, MultiplayerStandingEntry } from "@typ-nique/types";

export interface PlacementCandidate {
  playerId: string;
  displayName: string;
  joinedAt: string;
  finishedAt: string | null;
  finalPlace: number | null;
  score: number;
  solvedCount: number;
  attemptedCount: number;
  accuracy: number;
  completedRounds: number;
  currentRoundNumber: number;
  isReady: boolean;
  isHost: boolean;
  status: MultiplayerPlayerView["status"];
}

export function buildStandingsEntries(players: readonly MultiplayerPlayerView[]): MultiplayerStandingEntry[] {
  const ordered = [...players].sort(comparePlayersForStandings);

  return ordered.map((player, index) => ({
    rank: index + 1,
    playerId: player.playerId,
    displayName: player.displayName,
    score: player.score,
    solvedCount: player.solvedCount,
    attemptedCount: player.attemptedCount,
    accuracy: player.accuracy,
    completedRounds: player.completedRounds,
    currentRoundNumber: player.currentRoundNumber,
    finalPlace: player.finalPlace,
    finishedAt: player.finishedAt,
    isReady: player.isReady,
    isHost: player.isHost,
    status: player.status
  }));
}

export function assignFinalPlaces(players: readonly PlacementCandidate[]) {
  return [...players]
    .sort(comparePlayersForPlacement)
    .map((player, index) => ({
      playerId: player.playerId,
      finalPlace: index + 1
    }));
}

export function comparePlayersForStandings(left: MultiplayerPlayerView, right: MultiplayerPlayerView) {
  return (
    compareNullableNumbers(left.finalPlace, right.finalPlace, "asc") ||
    right.solvedCount - left.solvedCount ||
    right.score - left.score ||
    compareNullableTimes(left.finishedAt, right.finishedAt) ||
    left.joinedAt.localeCompare(right.joinedAt) ||
    left.playerId.localeCompare(right.playerId)
  );
}

export function comparePlayersForPlacement(left: PlacementCandidate, right: PlacementCandidate) {
  return (
    right.solvedCount - left.solvedCount ||
    right.score - left.score ||
    compareNullableTimes(left.finishedAt, right.finishedAt) ||
    left.joinedAt.localeCompare(right.joinedAt) ||
    left.playerId.localeCompare(right.playerId)
  );
}

function compareNullableNumbers(left: number | null, right: number | null, direction: "asc" | "desc") {
  if (left !== null && right !== null) {
    return direction === "asc" ? left - right : right - left;
  }

  if (left !== null) return -1;
  if (right !== null) return 1;
  return 0;
}

function compareNullableTimes(left: string | null, right: string | null) {
  if (left && right) {
    return new Date(left).getTime() - new Date(right).getTime();
  }

  if (left) return -1;
  if (right) return 1;
  return 0;
}
