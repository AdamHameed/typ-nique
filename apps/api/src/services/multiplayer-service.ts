import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  MultiplayerReplayDiagnosticsPlayer,
  MultiplayerPlayerView,
  MultiplayerRoomCountdownEventPayload,
  MultiplayerRoomPreview,
  MultiplayerRoomReplayData,
  MultiplayerRoomFinishedEventPayload,
  MultiplayerRoomSnapshotEventPayload,
  MultiplayerRoomState,
  MultiplayerRoomStandingsEventPayload,
  MultiplayerStandingEntry,
  RoundBreakdown,
  SessionStatus
} from "@typ-nique/types";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { publishRoomEvent } from "../lib/multiplayer-live-hub.js";
import { prisma } from "../lib/prisma.js";
import { assignFinalPlaces, buildStandingsEntries } from "./multiplayer-standings.js";
import { activateSession } from "./session-progression-service.js";

const DEFAULT_RULES_VERSION = 1;
const DEFAULT_MULTIPLAYER_DURATION_MINUTES = 2;
const FIXED_COUNTDOWN_MS = 5000;
const MAX_MULTIPLAYER_PLAYERS = 8;

export interface MultiplayerActor {
  userId: string | null;
  playerSessionId: string | null;
  user?: {
    id: string;
    username: string;
    email: string | null;
    displayName: string | null;
  } | null;
}

export interface CreateMultiplayerRoomInput {
  durationMinutes: number;
}

export interface RoomVersionGuard {
  expectedRoomVersion?: number;
}

type DbClient = PrismaClient | Prisma.TransactionClient;

type LoadedMatch = Prisma.MultiplayerMatchGetPayload<{
  include: {
    players: {
      orderBy: { joinedAt: "asc" };
      include: {
        user: true;
        playerSession: true;
        gameSession: {
          include: {
            user: true;
            rounds: {
              orderBy: { position: "asc" };
            };
          };
        };
      };
    };
  };
}>;

type LoadedSessionStatus = LoadedMatch["players"][number]["gameSession"] extends { status: infer T } | null ? T : never;

export async function createMultiplayerRoom(
  input: CreateMultiplayerRoomInput,
  actor: MultiplayerActor
): Promise<MultiplayerRoomState> {
  assertPlayerSession(actor);

  const seed = randomUUID();
  const challengeIds = await buildSharedChallengeSequence(seed);

  if (challengeIds.length === 0) {
    throw new Error("No active challenges are available for multiplayer.");
  }

  const roomCode = await generateUniqueRoomCode();
  const now = new Date();

  const matchId = await prisma.$transaction(async (tx) => {
    const match = await tx.multiplayerMatch.create({
      data: {
        mode: "LIVE",
        roomCode,
        status: "PENDING",
        maxPlayers: MAX_MULTIPLAYER_PLAYERS,
        rulesVersion: DEFAULT_RULES_VERSION,
        countdownDurationMs: FIXED_COUNTDOWN_MS,
        seed,
        challengeIds,
        startedRoundIndex: 0,
        roomVersion: 1
      }
    });

    const session = await createPendingMultiplayerSession(tx, {
      matchId: match.id,
      challengeIds,
      actor,
      seed,
      startedAt: now,
      durationMinutes: input.durationMinutes
    });

    const player = await tx.multiplayerMatchPlayer.create({
      data: {
        matchId: match.id,
        userId: actor.userId ?? undefined,
        playerSessionId: actor.playerSessionId!,
        gameSessionId: session.id,
        displayName: resolveActorDisplayName(actor),
        connectionStatus: "CONNECTED",
        lastHeartbeatAt: now
      }
    });

    await tx.multiplayerMatch.update({
      where: { id: match.id },
      data: {
        hostPlayerId: player.id,
        roomVersion: {
          increment: 1
        }
      }
    });

    return match.id;
  });

  const snapshot = await getMultiplayerRoom(matchId, actor);
  await publishAuthoritativeRoomEvents(matchId, "room-created");
  return snapshot;
}

export async function getMultiplayerRoom(matchId: string, actor: MultiplayerActor): Promise<MultiplayerRoomState> {
  await reconcileMultiplayerRoom(matchId);
  const match = await loadMatchOrThrow(prisma, { id: matchId });
  assertRoomAccess(match, actor);
  return buildRoomSnapshot(match, actor);
}

export async function getMultiplayerRoomByCode(roomCode: string, actor: MultiplayerActor): Promise<MultiplayerRoomState> {
  const normalizedCode = normalizeRoomCode(roomCode);
  await reconcileMultiplayerRoomByCode(normalizedCode);
  const match = await loadMatchOrThrow(prisma, { roomCode: normalizedCode });
  assertRoomAccess(match, actor);
  return buildRoomSnapshot(match, actor);
}

export async function getMultiplayerRoomPreviewByCode(roomCode: string): Promise<MultiplayerRoomPreview> {
  const normalizedCode = normalizeRoomCode(roomCode);
  await reconcileMultiplayerRoomByCode(normalizedCode);
  const match = await loadMatchOrThrow(prisma, { roomCode: normalizedCode });
  return buildRoomPreview(match);
}

export async function joinMultiplayerRoom(matchId: string, actor: MultiplayerActor, options: RoomVersionGuard = {}) {
  assertPlayerSession(actor);

  await prisma.$transaction(async (tx) => {
    const match = await loadMatchOrThrow(tx, { id: matchId });

    if (options.expectedRoomVersion !== undefined && match.roomVersion !== options.expectedRoomVersion) {
      throw new Error("Room version conflict.");
    }

    const existingMembership = findPlayerForActor(match.players, actor);

    if (existingMembership) {
      if (existingMembership.leftAt) {
        throw new Error("Player has already left this room.");
      }

      await touchMembershipHeartbeat(tx, existingMembership.id);
      return;
    }

    if (match.status !== "PENDING") {
      throw new Error("Room is no longer accepting new players.");
    }

    const activePlayers = match.players.filter((player) => !player.leftAt);

    if (activePlayers.length >= match.maxPlayers) {
      throw new Error("Room is already full.");
    }

    const session = await createPendingMultiplayerSession(tx, {
      matchId: match.id,
      challengeIds: match.challengeIds,
      actor,
      seed: match.seed,
      startedAt: new Date(),
      durationMinutes: getRoomDurationMinutes(match)
    });

    await tx.multiplayerMatchPlayer.create({
      data: {
        matchId: match.id,
        userId: actor.userId ?? undefined,
        playerSessionId: actor.playerSessionId!,
        gameSessionId: session.id,
        displayName: resolveActorDisplayName(actor),
        connectionStatus: "CONNECTED",
        lastHeartbeatAt: new Date()
      }
    });

    await bumpRoomVersion(tx, match.id, match.roomVersion);
  });

  await reconcileMultiplayerRoom(matchId);
  const snapshot = await getMultiplayerRoom(matchId, actor);
  await publishAuthoritativeRoomEvents(matchId, "room-joined");
  return snapshot;
}

export async function joinMultiplayerRoomByCode(roomCode: string, actor: MultiplayerActor, options: RoomVersionGuard = {}) {
  const normalizedCode = normalizeRoomCode(roomCode);
  const match = await loadMatchOrThrow(prisma, { roomCode: normalizedCode });
  return joinMultiplayerRoom(match.id, actor, options);
}

export async function leaveMultiplayerRoom(matchId: string, actor: MultiplayerActor, options: RoomVersionGuard = {}) {
  await prisma.$transaction(async (tx) => {
    const match = await loadMatchOrThrow(tx, { id: matchId });

    if (options.expectedRoomVersion !== undefined && match.roomVersion !== options.expectedRoomVersion) {
      throw new Error("Room version conflict.");
    }

    const player = requireMembership(match, actor);

    if (player.leftAt) {
      return;
    }

    const leftAt = new Date();
    const remainingPlayers = getActivePlayers(match).filter((entry) => entry.id !== player.id);

    await tx.multiplayerMatchPlayer.update({
      where: { id: player.id },
      data: {
        leftAt,
        readyAt: null,
        connectionStatus: "LEFT",
        lastHeartbeatAt: leftAt
      }
    });

    if (player.gameSessionId) {
      await tx.gameSession.update({
        where: { id: player.gameSessionId },
        data: {
          status: "ABANDONED",
          endedAt: leftAt
        }
      });
    }

    if (match.hostPlayerId === player.id) {
      await tx.multiplayerMatch.update({
        where: { id: match.id },
        data: {
          hostPlayerId: chooseNextHostId(remainingPlayers, match.seed, `${match.roomVersion}:leave`)
        }
      });
    }

    await bumpRoomVersion(tx, match.id, match.roomVersion);
  });

  await reconcileMultiplayerRoom(matchId);
  const snapshot = await getMultiplayerRoom(matchId, actor);
  await publishAuthoritativeRoomEvents(matchId, "room-left");
  return snapshot;
}

export async function resetMultiplayerRoomToLobby(matchId: string, actor: MultiplayerActor, options: RoomVersionGuard = {}) {
  await prisma.$transaction(async (tx) => {
    const match = await loadMatchOrThrow(tx, { id: matchId });

    if (options.expectedRoomVersion !== undefined && match.roomVersion !== options.expectedRoomVersion) {
      throw new Error("Room version conflict.");
    }

    const player = requireMembership(match, actor);

    if (match.hostPlayerId && match.hostPlayerId !== player.id) {
      throw new Error("Only the room host can reopen the lobby.");
    }

    if (match.status !== "COMPLETED") {
      throw new Error("Only completed rooms can be reopened.");
    }

    const activePlayers = getActivePlayers(match);

    if (activePlayers.length === 0) {
      throw new Error("No active players remain in this room.");
    }

    const seed = randomUUID();
    const challengeIds = await buildSharedChallengeSequence(seed);

    if (challengeIds.length === 0) {
      throw new Error("No active challenges are available for multiplayer.");
    }

    const durationMinutes = getRoomDurationMinutes(match);
    const now = new Date();

    for (const activePlayer of activePlayers) {
      const session = await createPendingMultiplayerSession(tx, {
        matchId: match.id,
        challengeIds,
        actor: {
          userId: activePlayer.userId,
          playerSessionId: activePlayer.playerSessionId,
          user: activePlayer.user
        },
        seed,
        startedAt: now,
        durationMinutes
      });

      await tx.multiplayerMatchPlayer.update({
        where: { id: activePlayer.id },
        data: {
          gameSessionId: session.id,
          readyAt: null,
          finishedAt: null,
          finalPlace: null
        }
      });
    }

    await updateRoomVersioned(tx, match.id, match.roomVersion, {
      status: "PENDING",
      startedAt: null,
      countdownEndsAt: null,
      finishedAt: null,
      challengeIds,
      seed,
      startedRoundIndex: 0
    });
  });

  await reconcileMultiplayerRoom(matchId);
  const snapshot = await getMultiplayerRoom(matchId, actor);
  await publishAuthoritativeRoomEvents(matchId, "room-reset");
  return snapshot;
}

export async function setMultiplayerReadiness(
  matchId: string,
  actor: MultiplayerActor,
  ready: boolean,
  options: RoomVersionGuard = {}
) {
  await prisma.$transaction(async (tx) => {
    const match = await loadMatchOrThrow(tx, { id: matchId });

    if (options.expectedRoomVersion !== undefined && match.roomVersion !== options.expectedRoomVersion) {
      throw new Error("Room version conflict.");
    }

    if (match.status !== "PENDING" && match.status !== "COUNTDOWN") {
      return;
    }

    const player = requireMembership(match, actor);

    if (player.leftAt) {
      throw new Error("Player has already left this room.");
    }

    await tx.multiplayerMatchPlayer.update({
      where: { id: player.id },
      data: {
        readyAt: ready ? new Date() : null,
        connectionStatus: "CONNECTED",
        lastHeartbeatAt: new Date()
      }
    });

    await bumpRoomVersion(tx, match.id, match.roomVersion);
  });

  await reconcileMultiplayerRoom(matchId);
  const snapshot = await getMultiplayerRoom(matchId, actor);
  await publishAuthoritativeRoomEvents(matchId, ready ? "player-ready" : "player-unready");
  return snapshot;
}

export async function startMultiplayerCountdown(matchId: string, actor: MultiplayerActor, options: RoomVersionGuard = {}) {
  await prisma.$transaction(async (tx) => {
    const match = await loadMatchOrThrow(tx, { id: matchId });

    if (options.expectedRoomVersion !== undefined && match.roomVersion !== options.expectedRoomVersion) {
      throw new Error("Room version conflict.");
    }

    const player = requireMembership(match, actor);

    if (match.hostPlayerId && match.hostPlayerId !== player.id) {
      throw new Error("Only the room host can start the countdown.");
    }

    if (match.status !== "PENDING" && match.status !== "COUNTDOWN") {
      return;
    }

    assertCountdownStartable(match);
    assertLockedChallengeSequence(match);
    await ensureLinkedSessionsForPlayers(tx, match, getActivePlayers(match));

    if (match.countdownEndsAt) {
      return;
    }

    await updateRoomVersioned(tx, match.id, match.roomVersion, {
      status: "COUNTDOWN",
      countdownEndsAt: new Date(Date.now() + FIXED_COUNTDOWN_MS),
      startedRoundIndex: 0
    });
  });

  await reconcileMultiplayerRoom(matchId);
  const snapshot = await getMultiplayerRoom(matchId, actor);
  await publishAuthoritativeRoomEvents(matchId, "countdown-started");
  return snapshot;
}

export async function touchMultiplayerHeartbeat(matchId: string, actor: MultiplayerActor) {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const match = await loadMatchOrThrow(tx, { id: matchId });
    const player = requireMembership(match, actor);

    await tx.multiplayerMatchPlayer.update({
      where: { id: player.id },
      data: {
        connectionStatus: player.leftAt ? "LEFT" : "CONNECTED",
        lastHeartbeatAt: now
      }
    });
  });
}

export async function setMultiplayerConnectionStatus(
  matchId: string,
  actor: MultiplayerActor,
  status: "CONNECTED" | "IDLE" | "DISCONNECTED" | "LEFT"
) {
  await prisma.$transaction(async (tx) => {
    const match = await loadMatchOrThrow(tx, { id: matchId });
    const player = requireMembership(match, actor);

    await tx.multiplayerMatchPlayer.update({
      where: { id: player.id },
      data: {
        connectionStatus: status,
        lastHeartbeatAt: new Date()
      }
    });
  });

  if (status === "DISCONNECTED" || status === "IDLE") {
    await publishAuthoritativeRoomEvents(matchId, "connection-status");
  }
}

export async function assertMultiplayerRoomMembership(matchId: string, actor: MultiplayerActor) {
  const match = await loadMatchOrThrow(prisma, { id: matchId });
  requireMembership(match, actor);
}

export async function getStandingsSnapshot(matchId: string, actor?: MultiplayerActor): Promise<MultiplayerStandingEntry[]> {
  await reconcileMultiplayerRoom(matchId);
  const match = await loadMatchOrThrow(prisma, { id: matchId });

  if (actor) {
    assertRoomAccess(match, actor);
  }

  return buildStandingsSnapshot(match);
}

export async function getMultiplayerRoomReplayData(
  matchId: string,
  actor: MultiplayerActor,
  options: { includeDiagnostics?: boolean } = {}
): Promise<MultiplayerRoomReplayData> {
  await reconcileMultiplayerRoom(matchId);
  const match = await loadMatchOrThrow(prisma, { id: matchId });
  assertRoomAccess(match, actor);

  const players = await prisma.multiplayerMatchPlayer.findMany({
    where: {
      matchId
    },
    orderBy: [
      { finalPlace: "asc" },
      { joinedAt: "asc" }
    ],
    include: {
      gameSession: {
        include: {
          rounds: {
            orderBy: { position: "asc" },
            include: {
              challenge: {
                include: {
                  category: true
                }
              },
              bestSubmission: true,
              submissions: {
                orderBy: { submittedAt: "desc" },
                take: 1
              }
            }
          }
        }
      }
    }
  });

  return {
    room: buildRoomSnapshot(match, actor),
    players: players.map((player) => ({
      playerId: player.id,
      gameSessionId: player.gameSessionId,
      displayName: player.displayName,
      finalPlace: player.finalPlace,
      connectionStatus: player.connectionStatus.toLowerCase() as MultiplayerRoomReplayData["players"][number]["connectionStatus"],
      score: player.gameSession?.totalScore ?? 0,
      solvedCount: player.gameSession?.promptsCorrect ?? 0,
      attemptedCount: player.gameSession?.promptsAttempted ?? 0,
      accuracy:
        player.gameSession && player.gameSession.promptsAttempted > 0
          ? player.gameSession.promptsCorrect / player.gameSession.promptsAttempted
          : 0,
      completedRounds: player.gameSession?.rounds.filter((round) => Boolean(round.resolvedAt)).length ?? 0,
      currentRoundNumber:
        player.gameSession?.rounds.find((round) => !round.resolvedAt)?.position
        ?? player.gameSession?.rounds.at(-1)?.position
        ?? 0,
      durationMs:
        player.gameSession?.endedAt && player.gameSession.startedAt
          ? Math.max(0, player.gameSession.endedAt.getTime() - player.gameSession.startedAt.getTime())
          : null,
      finishedAt: (player.finishedAt ?? player.gameSession?.endedAt)?.toISOString() ?? null,
      rounds: (player.gameSession?.rounds ?? []).map(mapRoundBreakdown)
    })),
    diagnostics: options.includeDiagnostics ? buildReplayDiagnostics(match) : null
  };
}

export async function finalizeMultiplayerPlacements(matchId: string) {
  await prisma.$transaction(async (tx) => {
    const match = await loadMatchOrThrow(tx, { id: matchId });
    await finalizePlacementsInTransaction(tx, match);
  });

  await publishAuthoritativeRoomEvents(matchId, "placements-finalized");
}

export async function syncMultiplayerSessionState(sessionId: string) {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: { matchId: true }
  });

  if (!session?.matchId) {
    return;
  }

  await reconcileMultiplayerRoom(session.matchId);
  await publishAuthoritativeRoomEvents(session.matchId, "session-synced");
}

export async function extendMultiplayerChallengeIds(
  matchId: string,
  sessionId: string,
  existingMetadata: Prisma.JsonValue,
  existingChallengeIds: string[]
) {
  // Multiplayer races extend the room-owned sequence once, then copy that
  // persisted extension back into every linked session so all players keep
  // drawing from the same authoritative prompt stream.
  const result = await prisma.$transaction(async (tx) => {
    const match = await loadMatchOrThrow(tx, { id: matchId });

    if (match.challengeIds.length > existingChallengeIds.length) {
      return match.challengeIds;
    }

    const nextCycle = await buildNextSharedChallengeCycle(match.seed, match.challengeIds);

    if (nextCycle.length === 0) {
      return existingChallengeIds;
    }

    const challengeIds = [...existingChallengeIds, ...nextCycle];
    const sessionMetadata =
      existingMetadata && typeof existingMetadata === "object" && !Array.isArray(existingMetadata) ? existingMetadata : {};

    await tx.multiplayerMatch.update({
      where: { id: match.id },
      data: {
        challengeIds
      }
    });

    await tx.gameSession.updateMany({
      where: {
        matchId: match.id
      },
      data: {
        metadata: buildSessionMetadata(match.id, challengeIds)
      }
    });

    await tx.gameSession.update({
      where: { id: sessionId },
      data: {
        metadata: {
          ...sessionMetadata,
          source: "multiplayer",
          matchId: match.id,
          challengeIds
        }
      }
    });

    return challengeIds;
  });

  return result;
}

export async function notifyMultiplayerRoundResolved(matchId: string, input?: {
  sessionId?: string;
  roundId?: string;
  reason?: string;
}) {
  await reconcileMultiplayerRoom(matchId);
  await publishAuthoritativeRoomEvents(matchId, input?.reason ?? "round-resolved");
}

/**
 * Safe for both REST and WebSocket callers.
 * It only performs authoritative server-side state transitions based on
 * persisted room/session data and never validates answers itself.
 */
export async function reconcileMultiplayerRoom(matchId: string) {
  let changed = false;

  await prisma.$transaction(async (tx) => {
    const match = await loadMatchOrThrow(tx, { id: matchId });
    const activePlayers = getActivePlayers(match);
    const currentHostActive = activePlayers.some((player) => player.id === match.hostPlayerId);

    if (!currentHostActive && activePlayers.length > 0) {
      changed = true;
      await updateRoomVersioned(tx, match.id, match.roomVersion, {
        hostPlayerId: chooseNextHostId(activePlayers, match.seed, `${match.roomVersion}:repair`)
      });
      return;
    }

    if (activePlayers.length === 0 && match.status !== "CANCELLED") {
      changed = true;
      await updateRoomVersioned(tx, match.id, match.roomVersion, {
        status: "CANCELLED",
        countdownEndsAt: null,
        finishedAt: new Date()
      });
      return;
    }

    if ((match.status === "PENDING" || match.status === "COUNTDOWN") && !canStartCountdown(match) && match.countdownEndsAt) {
      changed = true;
      await updateRoomVersioned(tx, match.id, match.roomVersion, {
        status: "PENDING",
        countdownEndsAt: null
      });
      return;
    }

    if ((match.status === "PENDING" || match.status === "COUNTDOWN") && match.countdownEndsAt && match.countdownEndsAt.getTime() <= Date.now()) {
      changed = true;
      await activateCountdownStart(tx, match);
      return;
    }

    if (match.status === "ACTIVE" || match.status === "COMPLETED") {
      const beforeVersion = match.roomVersion;
      await finalizePlacementsInTransaction(tx, match);
      const refreshed = await loadMatchOrThrow(tx, { id: match.id });
      changed = refreshed.roomVersion !== beforeVersion;
    }
  });

  if (changed) {
    await publishAuthoritativeRoomEvents(matchId, "room-reconciled");
  }
}

async function reconcileMultiplayerRoomByCode(roomCode: string) {
  const match = await prisma.multiplayerMatch.findUnique({
    where: { roomCode },
    select: { id: true }
  });

  if (!match) {
    throw new Error("No MultiplayerMatch found");
  }

  await reconcileMultiplayerRoom(match.id);
}

async function activateCountdownStart(tx: Prisma.TransactionClient, match: LoadedMatch) {
  const activePlayers = getActivePlayers(match);
  assertLockedChallengeSequence(match);
  await ensureLinkedSessionsForPlayers(tx, match, activePlayers);

  if (activePlayers.length < 2) {
    throw new Error("At least two active players are required to start.");
  }

  const startAt = match.countdownEndsAt ?? new Date();
  const refreshedMatch = await loadMatchOrThrow(tx, { id: match.id });
  const refreshedActivePlayers = getActivePlayers(refreshedMatch);

  await updateRoomVersioned(tx, refreshedMatch.id, refreshedMatch.roomVersion, {
    status: "ACTIVE",
    startedAt: startAt,
    countdownEndsAt: null,
    startedRoundIndex: 1
  });

  for (const player of refreshedActivePlayers) {
    await tx.gameSession.update({
      where: { id: player.gameSessionId! },
      data: {
        seed: refreshedMatch.roomCode,
        metadata: buildSessionMetadata(refreshedMatch.id, refreshedMatch.challengeIds)
      }
    });
  }

  for (const player of refreshedActivePlayers) {
    await activateSession(player.gameSessionId!, {
      db: tx,
      startedAt: startAt,
      seed: refreshedMatch.roomCode,
      challengeIds: refreshedMatch.challengeIds
    });
  }
}

async function finalizePlacementsInTransaction(tx: Prisma.TransactionClient, staleMatch: LoadedMatch) {
  const match = await loadMatchOrThrow(tx, { id: staleMatch.id });
  const finishedPlayers = match.players.filter((player) => isTerminalStatus(player.gameSession?.status));

  for (const player of finishedPlayers) {
    if (!player.finishedAt && player.gameSession?.endedAt) {
      await tx.multiplayerMatchPlayer.update({
        where: { id: player.id },
        data: {
          finishedAt: player.gameSession.endedAt
        }
      });
    }
  }

  const refreshed = await loadMatchOrThrow(tx, { id: match.id });
  const placed = refreshed.players.filter((player) => player.finalPlace !== null);
  const pendingPlacement = refreshed.players
    .filter((player) => player.finalPlace === null)
    .filter((player) => isTerminalStatus(player.gameSession?.status));

  if (pendingPlacement.length > 0) {
    const assignments = assignFinalPlaces(pendingPlacement.map((player) => ({
      playerId: player.id,
      displayName: player.displayName,
      joinedAt: player.joinedAt.toISOString(),
      finishedAt: (player.finishedAt ?? player.gameSession?.endedAt)?.toISOString() ?? null,
      finalPlace: player.finalPlace,
      score: player.gameSession?.totalScore ?? 0,
      solvedCount: player.gameSession?.promptsCorrect ?? 0,
      attemptedCount: player.gameSession?.promptsAttempted ?? 0,
      accuracy:
        player.gameSession && player.gameSession.promptsAttempted > 0
          ? player.gameSession.promptsCorrect / player.gameSession.promptsAttempted
          : 0,
      completedRounds: player.gameSession?.rounds.filter((round) => Boolean(round.resolvedAt)).length ?? 0,
      currentRoundNumber: player.gameSession?.rounds.find((round) => !round.resolvedAt)?.position
        ?? player.gameSession?.rounds.at(-1)?.position
        ?? 0,
      isReady: Boolean(player.readyAt) && !player.leftAt,
      isHost: refreshed.hostPlayerId === player.id,
      status: mapSessionStatus(player.gameSession?.status)
    })));

    const nextPlace = placed.length;

    for (const assignment of assignments) {
      const player = pendingPlacement.find((entry) => entry.id === assignment.playerId);

      if (!player) {
        continue;
      }

      await tx.multiplayerMatchPlayer.update({
        where: { id: assignment.playerId },
        data: {
          finalPlace: nextPlace + assignment.finalPlace,
          finishedAt: player.finishedAt ?? player.gameSession?.endedAt ?? new Date()
        }
      });
    }
  }

  const finalized = await loadMatchOrThrow(tx, { id: match.id });
  const activePlayers = getActivePlayers(finalized);

  if (
    finalized.status === "ACTIVE" &&
    activePlayers.length > 0 &&
    activePlayers.every((player) => isTerminalStatus(player.gameSession?.status))
  ) {
    const finishedAt = activePlayers
      .map((player) => player.gameSession?.endedAt ?? player.finishedAt ?? finalized.startedAt ?? new Date())
      .sort((left, right) => right.getTime() - left.getTime())[0];

    await updateRoomVersioned(tx, finalized.id, finalized.roomVersion, {
      status: "COMPLETED",
      finishedAt
    });
  }
}

async function createPendingMultiplayerSession(
  tx: Prisma.TransactionClient,
  input: {
    matchId: string;
    challengeIds: string[];
    actor: MultiplayerActor;
    seed: string;
    startedAt: Date;
    durationMinutes: number;
  }
) {
  return tx.gameSession.create({
    data: {
      playerSessionId: input.actor.playerSessionId!,
      userId: input.actor.userId ?? undefined,
      mode: "MULTIPLAYER",
      status: "PENDING",
      matchId: input.matchId,
      startedAt: input.startedAt,
      timeLimitMs: input.durationMinutes * 60 * 1000,
      seed: input.seed,
      metadata: buildSessionMetadata(input.matchId, input.challengeIds)
    }
  });
}

async function loadMatchOrThrow(db: DbClient, where: { id: string } | { roomCode: string }): Promise<LoadedMatch> {
  return db.multiplayerMatch.findUniqueOrThrow({
    where,
    include: {
      players: {
        orderBy: { joinedAt: "asc" },
        include: {
          user: true,
          playerSession: true,
          gameSession: {
            include: {
              user: true,
              rounds: {
                orderBy: { position: "asc" }
              }
            }
          }
        }
      }
    }
  });
}

async function updateRoomVersioned(
  tx: Prisma.TransactionClient,
  matchId: string,
  expectedRoomVersion: number,
  data: Prisma.MultiplayerMatchUncheckedUpdateInput
) {
  const result = await tx.multiplayerMatch.updateMany({
    where: {
      id: matchId,
      roomVersion: expectedRoomVersion
    },
    data: {
      ...data,
      roomVersion: {
        increment: 1
      }
    }
  });

  if (result.count !== 1) {
    throw new Error("Room version conflict.");
  }
}

async function bumpRoomVersion(tx: Prisma.TransactionClient, matchId: string, expectedRoomVersion: number) {
  await updateRoomVersioned(tx, matchId, expectedRoomVersion, {});
}

async function touchMembershipHeartbeat(tx: Prisma.TransactionClient, membershipId: string) {
  await tx.multiplayerMatchPlayer.update({
    where: { id: membershipId },
    data: {
      connectionStatus: "CONNECTED",
      lastHeartbeatAt: new Date()
    }
  });
}

function buildRoomSnapshot(match: LoadedMatch, actor?: MultiplayerActor | null): MultiplayerRoomState {
  const localPlayer = actor ? findPlayerForActor(match.players, actor) ?? null : null;
  const players = match.players.map((player) => toPlayerView(player, match.hostPlayerId));
  const standings = buildStandingsSnapshot(match);
  const countdownState = getCountdownState(match);

  return {
    id: match.id,
    roomCode: match.roomCode,
    roomVersion: match.roomVersion,
    mode: "live",
    status: mapRoomStatus(match.status),
    createdAt: match.createdAt.toISOString(),
    startedAt: match.startedAt?.toISOString() ?? null,
    raceStartsAt: countdownState.raceStartsAt,
    countdownEndsAt: match.countdownEndsAt?.toISOString() ?? null,
    countdownRemainingMs: countdownState.countdownRemainingMs,
    endedAt: match.finishedAt?.toISOString() ?? null,
    maxPlayers: match.maxPlayers,
    durationMinutes: getRoomDurationMinutes(match),
    startedRoundIndex: match.startedRoundIndex,
    isLocked: match.status === "COUNTDOWN" || match.status === "ACTIVE" || match.status === "COMPLETED",
    localPlayerId: localPlayer?.id ?? null,
    localSessionId: localPlayer?.gameSessionId ?? null,
    canStart: canStartCountdown(match),
    players,
    standings,
    finalPlacements: standings
      .filter((entry) => entry.finalPlace !== null)
      .sort((left, right) => (left.finalPlace ?? Number.MAX_SAFE_INTEGER) - (right.finalPlace ?? Number.MAX_SAFE_INTEGER))
  };
}

function buildRoomPreview(match: LoadedMatch): MultiplayerRoomPreview {
  const activePlayers = getActivePlayers(match);
  const host = match.players.find((player) => player.id === match.hostPlayerId) ?? null;

  return {
    id: match.id,
    roomCode: match.roomCode,
    status: mapRoomStatus(match.status),
    maxPlayers: match.maxPlayers,
    durationMinutes: getRoomDurationMinutes(match),
    playerCount: activePlayers.length,
    hostDisplayName: host?.displayName ?? null,
    createdAt: match.createdAt.toISOString(),
    startedAt: match.startedAt?.toISOString() ?? null
  };
}

function buildReplayDiagnostics(match: LoadedMatch): MultiplayerRoomReplayData["diagnostics"] {
  return {
    generatedAt: new Date().toISOString(),
    roomId: match.id,
    roomCode: match.roomCode,
    roomVersion: match.roomVersion,
    roomStatus: mapRoomStatus(match.status),
    raceStartsAt: match.startedAt?.toISOString() ?? match.countdownEndsAt?.toISOString() ?? null,
    countdownEndsAt: match.countdownEndsAt?.toISOString() ?? null,
    finishedAt: match.finishedAt?.toISOString() ?? null,
    playerCount: match.players.length,
    diagnosticsPlayers: match.players.map((player) => {
      const rounds = player.gameSession?.rounds ?? [];
      const completedRounds = rounds.filter((round) => Boolean(round.resolvedAt)).length;
      const currentRoundNumber = rounds.find((round) => !round.resolvedAt)?.position ?? rounds.at(-1)?.position ?? 0;

      return {
        playerId: player.id,
        displayName: player.displayName,
        gameSessionId: player.gameSessionId,
        connectionStatus: player.connectionStatus.toLowerCase() as MultiplayerReplayDiagnosticsPlayer["connectionStatus"],
        sessionStatus: mapSessionStatus(player.gameSession?.status),
        joinedAt: player.joinedAt.toISOString(),
        readyAt: player.readyAt?.toISOString() ?? null,
        leftAt: player.leftAt?.toISOString() ?? null,
        finishedAt: (player.finishedAt ?? player.gameSession?.endedAt)?.toISOString() ?? null,
        lastHeartbeatAt: player.lastHeartbeatAt?.toISOString() ?? null,
        finalPlace: player.finalPlace,
        score: player.gameSession?.totalScore ?? 0,
        solvedCount: player.gameSession?.promptsCorrect ?? 0,
        attemptedCount: player.gameSession?.promptsAttempted ?? 0,
        completedRounds,
        currentRoundNumber
      };
    })
  };
}

async function publishAuthoritativeRoomEvents(matchId: string, reason: string) {
  const match = await loadMatchOrThrow(prisma, { id: matchId });
  const snapshot = buildRoomSnapshot(match, null);
  const standings = buildStandingsSnapshot(match);
  const countdownState = getCountdownState(match);

  const snapshotPayload: MultiplayerRoomSnapshotEventPayload = {
    reason,
    room: snapshot
  };
  publishRoomEvent(match.id, match.roomVersion, "room.snapshot", snapshotPayload);

  const standingsPayload: MultiplayerRoomStandingsEventPayload = {
    reason,
    standings
  };
  publishRoomEvent(match.id, match.roomVersion, "room.standings", standingsPayload);

  if (match.status === "COUNTDOWN") {
    const countdownPayload: MultiplayerRoomCountdownEventPayload = {
      reason,
      countdownEndsAt: match.countdownEndsAt?.toISOString() ?? null,
      countdownRemainingMs: countdownState.countdownRemainingMs,
      raceStartsAt: countdownState.raceStartsAt,
      startedRoundIndex: match.startedRoundIndex,
      isLocked: true
    };
    publishRoomEvent(match.id, match.roomVersion, "room.countdown", countdownPayload);
  }

  if (match.status === "COMPLETED") {
    const finishedPayload: MultiplayerRoomFinishedEventPayload = {
      reason,
      finishedAt: match.finishedAt?.toISOString() ?? null,
      placements: standings.filter((entry) => entry.finalPlace !== null)
    };
    publishRoomEvent(match.id, match.roomVersion, "room.finished", finishedPayload);
  }
}

function buildStandingsSnapshot(match: LoadedMatch): MultiplayerStandingEntry[] {
  return buildStandingsEntries(
    match.players
      .filter((player) => !player.leftAt)
      .map((player) => toPlayerView(player, match.hostPlayerId))
  );
}

function toPlayerView(player: LoadedMatch["players"][number], hostPlayerId: string | null): MultiplayerPlayerView {
  const rounds = player.gameSession?.rounds ?? [];
  const completedRounds = rounds.filter((round) => Boolean(round.resolvedAt)).length;
  const currentRound = rounds.find((round) => !round.resolvedAt) ?? rounds.at(-1) ?? null;

  return {
    playerId: player.id,
    gameSessionId: player.gameSessionId ?? null,
    userId: player.userId,
    playerSessionId: player.playerSessionId,
    displayName: player.displayName,
    connectionStatus: player.connectionStatus.toLowerCase() as MultiplayerPlayerView["connectionStatus"],
    joinedAt: player.joinedAt.toISOString(),
    readyAt: player.readyAt?.toISOString() ?? null,
    leftAt: player.leftAt?.toISOString() ?? null,
    finishedAt: (player.finishedAt ?? player.gameSession?.endedAt)?.toISOString() ?? null,
    isHost: hostPlayerId === player.id,
    isReady: Boolean(player.readyAt) && !player.leftAt,
    status: mapSessionStatus(player.gameSession?.status),
    finalPlace: player.finalPlace,
    score: player.gameSession?.totalScore ?? 0,
    solvedCount: player.gameSession?.promptsCorrect ?? 0,
    attemptedCount: player.gameSession?.promptsAttempted ?? 0,
    accuracy:
      player.gameSession && player.gameSession.promptsAttempted > 0
        ? player.gameSession.promptsCorrect / player.gameSession.promptsAttempted
        : 0,
    completedRounds,
    currentRoundNumber: currentRound?.position ?? completedRounds
  };
}

function mapRoundBreakdown(
  round: {
    id: string;
    position: number;
    scoreAwarded: number;
    finalVerdict: "CORRECT" | "INCORRECT" | "COMPILE_ERROR" | "TIMEOUT" | null;
    finalMatchTier: "EXACT" | "NORMALIZED" | "RENDERED" | "ALTERNATE" | "NONE" | null;
    timeTakenMs: number | null;
    metadata: unknown;
    challenge: {
      id: string;
      title: string;
      slug: string;
      difficulty: number;
    };
    bestSubmission: { rawSource: string; feedback: string | null } | null;
    submissions: Array<{ rawSource: string; feedback: string | null }>;
  }
): RoundBreakdown {
  const latestSubmission = round.bestSubmission ?? round.submissions[0] ?? null;
  const skipped = Boolean(round.metadata && typeof round.metadata === "object" && "skipped" in round.metadata && (round.metadata as { skipped?: unknown }).skipped);

  return {
    roundId: round.id,
    position: round.position,
    challengeId: round.challenge.id,
    challengeTitle: round.challenge.title,
    challengeSlug: round.challenge.slug,
    difficulty: difficultyToLabel(round.challenge.difficulty),
    verdict: skipped ? "skipped" : mapVerdict(round.finalVerdict),
    matchTier: mapMatchTier(round.finalMatchTier),
    scoreAwarded: round.scoreAwarded,
    submittedSource: latestSubmission?.rawSource,
    feedback: latestSubmission?.feedback ?? (skipped ? "Skipped by player." : undefined),
    explanation: latestSubmission?.feedback ?? (skipped ? "The round was skipped before submission." : undefined),
    timeTakenMs: round.timeTakenMs
  };
}

function assertCountdownStartable(match: LoadedMatch) {
  if (getActivePlayers(match).length < 2) {
    throw new Error("At least two active players are required to start.");
  }

  if (!canStartCountdown(match)) {
    throw new Error("All joined players must be ready before the race can start.");
  }
}

function canStartCountdown(match: LoadedMatch) {
  const activePlayers = getActivePlayers(match);
  return activePlayers.length >= 2 && activePlayers.every((player) => Boolean(player.readyAt));
}

function assertLockedChallengeSequence(match: LoadedMatch) {
  if (match.challengeIds.length === 0) {
    throw new Error("Multiplayer room has no locked challenge sequence.");
  }
}

async function ensureLinkedSessionsForPlayers(
  tx: Prisma.TransactionClient,
  match: LoadedMatch,
  players: LoadedMatch["players"]
) {
  for (const player of players) {
    if (player.gameSessionId) {
      continue;
    }

    if (!player.playerSessionId) {
      throw new Error("Multiplayer player is missing a player session.");
    }

    const session = await createPendingMultiplayerSession(tx, {
      matchId: match.id,
      challengeIds: match.challengeIds,
      actor: {
        userId: player.userId,
        playerSessionId: player.playerSessionId,
        user: player.user
      },
      seed: match.seed,
      startedAt: new Date(),
      durationMinutes: getRoomDurationMinutes(match)
    });

    await tx.multiplayerMatchPlayer.update({
      where: { id: player.id },
      data: {
        gameSessionId: session.id
      }
    });
  }
}

function getActivePlayers(match: LoadedMatch) {
  return match.players.filter((player) => !player.leftAt);
}

function chooseNextHostId(players: LoadedMatch["players"], seed: string, salt: string) {
  if (players.length === 0) {
    return null;
  }

  return [...players]
    .sort((left, right) => seededSortKey(`${seed}:${salt}`, left.id).localeCompare(seededSortKey(`${seed}:${salt}`, right.id)))[0]
    ?.id ?? null;
}

function getCountdownState(match: LoadedMatch) {
  const raceStartsAt = match.countdownEndsAt?.toISOString() ?? match.startedAt?.toISOString() ?? null;
  const countdownRemainingMs = match.countdownEndsAt ? Math.max(0, match.countdownEndsAt.getTime() - Date.now()) : 0;

  return {
    raceStartsAt,
    countdownRemainingMs
  };
}

function findPlayerForActor(players: LoadedMatch["players"], actor: MultiplayerActor) {
  return players.find((player) => {
    if (actor.userId && player.userId === actor.userId) {
      return true;
    }

    if (actor.playerSessionId && player.playerSessionId === actor.playerSessionId) {
      return true;
    }

    return false;
  });
}

function requireMembership(match: LoadedMatch, actor: MultiplayerActor) {
  const player = findPlayerForActor(match.players, actor);

  if (!player) {
    throw new Error("Room not accessible.");
  }

  return player;
}

function assertRoomAccess(match: LoadedMatch, actor: MultiplayerActor) {
  requireMembership(match, actor);
}

function assertPlayerSession(actor: MultiplayerActor) {
  if (!actor.playerSessionId) {
    throw new Error("Player session required.");
  }
}

function mapRoomStatus(status: LoadedMatch["status"]): MultiplayerRoomState["status"] {
  if (status === "COUNTDOWN") return "countdown";
  if (status === "PENDING") return "pending";
  if (status === "ACTIVE") return "active";
  if (status === "COMPLETED") return "completed";
  return "cancelled";
}

function mapSessionStatus(status: LoadedSessionStatus | undefined): SessionStatus {
  if (!status) return "pending";
  return status.toLowerCase() as SessionStatus;
}

function difficultyToLabel(difficulty: number): "easy" | "medium" | "hard" {
  if (difficulty <= 1) return "easy";
  if (difficulty === 2) return "medium";
  return "hard";
}

function mapVerdict(verdict: "CORRECT" | "INCORRECT" | "COMPILE_ERROR" | "TIMEOUT" | null): RoundBreakdown["verdict"] {
  if (!verdict) return "pending";
  return verdict.toLowerCase() as RoundBreakdown["verdict"];
}

function mapMatchTier(tier: "EXACT" | "NORMALIZED" | "RENDERED" | "ALTERNATE" | "NONE" | null): RoundBreakdown["matchTier"] {
  if (!tier) return "none";
  return tier.toLowerCase() as RoundBreakdown["matchTier"];
}

function isTerminalStatus(status: LoadedSessionStatus | undefined) {
  return status === "COMPLETED" || status === "ABANDONED";
}

function buildSessionMetadata(matchId: string, challengeIds: string[]) {
  return {
    source: "multiplayer",
    matchId,
    challengeIds
  } satisfies Prisma.JsonObject;
}

function normalizeRoomCode(roomCode: string) {
  return roomCode.trim().toUpperCase();
}

function generateRoomCode() {
  return randomBytes(3).toString("hex").toUpperCase();
}

async function generateUniqueRoomCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const roomCode = generateRoomCode();
    const existing = await prisma.multiplayerMatch.findUnique({
      where: { roomCode },
      select: { id: true }
    });

    if (!existing) {
      return roomCode;
    }
  }

  throw new Error("Unable to allocate a unique room code.");
}

function resolveActorDisplayName(actor: MultiplayerActor) {
  return actor.user?.displayName ?? actor.user?.username ?? `Guest ${actor.playerSessionId?.slice(0, 6) ?? "player"}`;
}

function getRoomDurationMinutes(match: LoadedMatch) {
  const sessionDurationMs = match.players.find((player) => player.gameSession?.timeLimitMs)?.gameSession?.timeLimitMs;
  if (!sessionDurationMs || sessionDurationMs <= 0) {
    return DEFAULT_MULTIPLAYER_DURATION_MINUTES;
  }

  return Math.max(1, Math.round(sessionDurationMs / 60_000));
}

async function buildSharedChallengeSequence(seed: string) {
  const challenges = await prisma.challenge.findMany({
    where: {
      status: "ACTIVE",
      canonicalArtifactId: {
        not: null
      }
    },
    select: {
      id: true,
      slug: true
    }
  });

  return [...challenges]
    .sort((left, right) => seededSortKey(seed, left.slug).localeCompare(seededSortKey(seed, right.slug)))
    .map((challenge) => challenge.id);
}

async function buildNextSharedChallengeCycle(seed: string, existingChallengeIds: string[]) {
  const challenges = await prisma.challenge.findMany({
    where: {
      status: "ACTIVE",
      canonicalArtifactId: {
        not: null
      }
    },
    select: {
      id: true,
      slug: true
    }
  });

  if (challenges.length === 0) {
    return [];
  }

  const cycleIndex = Math.floor(existingChallengeIds.length / challenges.length);
  const nextCycle = [...challenges]
    .sort((left, right) => seededSortKey(`${seed}:${cycleIndex + 1}`, left.slug).localeCompare(seededSortKey(`${seed}:${cycleIndex + 1}`, right.slug)))
    .map((challenge) => challenge.id);

  if (existingChallengeIds.length > 0 && nextCycle.length > 1 && nextCycle[0] === existingChallengeIds.at(-1)) {
    nextCycle.push(nextCycle.shift()!);
  }

  return nextCycle;
}

function seededSortKey(seed: string, value: string) {
  return createHash("sha256").update(`${seed}:${value}`).digest("hex");
}

/**
 * Intended call patterns:
 * - REST-safe: `createMultiplayerRoom`, `getMultiplayerRoom`, `getMultiplayerRoomByCode`,
 *   `joinMultiplayerRoom`, `joinMultiplayerRoomByCode`, `leaveMultiplayerRoom`,
 *   `setMultiplayerReadiness`, `startMultiplayerCountdown`, `getStandingsSnapshot`.
 * - WebSocket/event-safe: `touchMultiplayerHeartbeat`, `reconcileMultiplayerRoom`,
 *   `syncMultiplayerSessionState`, `finalizeMultiplayerPlacements`.
 *
 * The WebSocket-oriented methods are still safe from REST, but they are lower-level:
 * they assume the caller is coordinating frequent state refreshes or background events.
 */
