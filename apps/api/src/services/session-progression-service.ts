import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export interface SessionProgressionOptions {
  onSessionCompleted?: (sessionId: string) => Promise<void> | void;
  extendChallengeIds?: (input: {
    sessionId: string;
    metadata: Prisma.JsonValue;
    challengeIds: string[];
  }) => Promise<string[]>;
}

export interface ActivateSessionOptions {
  startedAt?: Date;
  seed?: string | null;
  challengeIds?: string[];
  db?: PrismaClient | Prisma.TransactionClient;
}

/**
 * Shared progression primitive used by both solo and multiplayer flows.
 * It only cares about session state + persisted challenge sequence.
 */
export async function ensureSessionProgression(sessionId: string, options: SessionProgressionOptions = {}) {
  await expireSessionIfNeeded(sessionId, options);

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      rounds: {
        orderBy: { position: "desc" },
        take: 1
      }
    }
  });

  if (!session || session.status !== "ACTIVE") {
    return;
  }

  const latestRound = session.rounds[0];

  if (!latestRound || !latestRound.resolvedAt) {
    return;
  }

  let challengeIds = getSessionChallengeIds(session.metadata);
  const nextIndex = latestRound.position;

  if (nextIndex >= challengeIds.length && options.extendChallengeIds) {
    challengeIds = await options.extendChallengeIds({
      sessionId: session.id,
      metadata: session.metadata,
      challengeIds
    });
  }

  if (nextIndex >= challengeIds.length) {
    await completeSession(session.id, new Date(), options);
    return;
  }

  const nextPosition = latestRound.position + 1;
  await ensureRoundExists(session.id, nextPosition, challengeIds[nextIndex]!);
}

/**
 * Shared session activation primitive.
 * Multiplayer uses this to start all linked sessions without duplicating
 * round-creation logic. Solo can also use it to bootstrap the first round.
 */
export async function activateSession(sessionId: string, options: ActivateSessionOptions = {}) {
  const db = options.db ?? prisma;
  const session = await db.gameSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      metadata: true
    }
  });

  if (!session) {
    throw new Error("Session not found.");
  }

  const challengeIds = options.challengeIds ?? getSessionChallengeIds(session.metadata);
  const firstChallengeId = challengeIds[0];

  if (!firstChallengeId) {
    throw new Error("Session has no challenge sequence.");
  }

  const startedAt = options.startedAt ?? new Date();

  await db.gameSession.update({
    where: { id: sessionId },
    data: {
      status: "ACTIVE",
      startedAt,
      endedAt: null,
      ...(options.seed !== undefined ? { seed: options.seed } : {})
    }
  });

  await ensureRoundExists(sessionId, 1, firstChallengeId, startedAt, db);
}

export async function completeSession(
  sessionId: string,
  endedAt: Date,
  options: Pick<SessionProgressionOptions, "onSessionCompleted"> = {}
) {
  await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      status: "COMPLETED",
      endedAt
    }
  });

  await options.onSessionCompleted?.(sessionId);
}

export async function expireSessionIfNeeded(
  sessionId: string,
  options: Pick<SessionProgressionOptions, "onSessionCompleted"> = {}
) {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId }
  });

  if (!session || session.status !== "ACTIVE") {
    return;
  }

  const endsAt = session.startedAt.getTime() + (session.timeLimitMs ?? 0);

  if (!session.timeLimitMs || Date.now() < endsAt) {
    return;
  }

  await completeSession(session.id, new Date(endsAt), options);
}

export function getSessionChallengeIds(metadata: Prisma.JsonValue): string[] {
  if (!metadata || typeof metadata !== "object" || !("challengeIds" in metadata)) {
    return [];
  }

  const challengeIds = (metadata as { challengeIds?: unknown }).challengeIds;
  return Array.isArray(challengeIds) ? challengeIds.filter((value): value is string => typeof value === "string") : [];
}

async function ensureRoundExists(
  sessionId: string,
  position: number,
  challengeId: string,
  presentedAt?: Date,
  db: PrismaClient | Prisma.TransactionClient = prisma
) {
  const existingRound = await db.gameRound.findFirst({
    where: {
      gameSessionId: sessionId,
      position
    }
  });

  if (existingRound) {
    return existingRound;
  }

  return db.gameRound.create({
    data: {
      gameSessionId: sessionId,
      challengeId,
      position,
      ...(presentedAt ? { presentedAt } : {})
    }
  });
}
