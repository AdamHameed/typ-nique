import type {
  ChallengeDifficulty,
  ChallengeRoundPayload,
  GameSessionResult,
  GameSessionState,
  MatchTier,
  RoundBreakdown,
  SubmissionVerdict
} from "@typ-nique/types";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ensureDailyChallengeForDate, getChallengeRotation } from "./challenge-service.js";

const PRACTICE_DURATION_MS = 3 * 60 * 1000;

interface SessionActor {
  userId: string | null;
  playerSessionId: string | null;
}

export async function createGameSession(mode: "practice" | "daily", actor: SessionActor): Promise<GameSessionState> {
  const startedAt = new Date();
  const dailyChallenge = mode === "daily" ? await ensureDailyChallengeForDate(startedAt) : null;
  const existingSession = await prisma.gameSession.findFirst({
    where: {
      mode: mode.toUpperCase() as "PRACTICE" | "DAILY",
      status: "ACTIVE",
      ...(actor.userId ? { userId: actor.userId } : { playerSessionId: actor.playerSessionId! }),
      ...(mode === "daily" ? { dailyChallengeId: dailyChallenge?.id } : {})
    },
    orderBy: { startedAt: "desc" }
  });

  if (existingSession) {
    return getGameSessionStateOrThrow(existingSession.id);
  }

  const challengeIds =
    mode === "daily"
      ? dailyChallenge?.items.map((item) => item.challengeId) ?? []
      : shuffle((await getChallengeRotation(30)).map((challenge) => challenge.id));

  if (challengeIds.length === 0) {
    throw new Error("No active challenges are available.");
  }

  const session = await prisma.gameSession.create({
    data: {
      mode: mode.toUpperCase() as "PRACTICE" | "DAILY",
      status: "ACTIVE",
      startedAt,
      timeLimitMs: PRACTICE_DURATION_MS,
      seed: randomUUID(),
      playerSessionId: actor.playerSessionId!,
      userId: actor.userId,
      dailyChallengeId: dailyChallenge?.id,
      metadata: {
        challengeIds,
        dailyChallengeDate: dailyChallenge?.challengeDate.toISOString() ?? null
      },
      rounds: {
        create: {
          position: 1,
          challengeId: challengeIds[0]!
        }
      }
    }
  });

  return getGameSessionStateOrThrow(session.id);
}

export async function getGameSessionState(sessionId: string, actor: SessionActor): Promise<GameSessionState | null> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      playerSessionId: true
    }
  });

  if (!session) {
    return null;
  }

  assertSessionAccess(session, actor);

  await ensureSessionProgression(sessionId);
  return getGameSessionStateOrThrow(sessionId);
}

export async function skipCurrentRound(sessionId: string, roundId: string, actor: SessionActor): Promise<GameSessionState> {
  const round = await prisma.gameRound.findUnique({
    where: { id: roundId },
    include: { gameSession: true }
  });

  if (!round || round.gameSessionId !== sessionId) {
    throw new Error("Round not found for session.");
  }

  assertSessionAccess(round.gameSession, actor);

  await expireSessionIfNeeded(round.gameSessionId);

  if (round.gameSession.status !== "ACTIVE") {
    return getGameSessionStateOrThrow(sessionId);
  }

  await prisma.gameRound.update({
    where: { id: round.id },
    data: {
      finalVerdict: "INCORRECT",
      finalMatchTier: "NONE",
      resolvedAt: new Date(),
      metadata: {
        skipped: true
      }
    }
  });

  await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      promptsAttempted: { increment: 1 }
    }
  });

  await ensureSessionProgression(sessionId);
  return getGameSessionStateOrThrow(sessionId);
}

export async function finishGameSession(sessionId: string, actor: SessionActor): Promise<GameSessionResult> {
  const session = await prisma.gameSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      playerSessionId: true
    }
  });

  assertSessionAccess(session, actor);

  await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      status: "COMPLETED",
      endedAt: new Date()
    }
  });

  return getGameSessionResults(sessionId, actor);
}

export async function getGameSessionResults(sessionId: string, actor: SessionActor): Promise<GameSessionResult> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
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
  });

  if (!session) {
    throw new Error("Session not found.");
  }

  assertSessionAccess(session, actor);

  const rounds: RoundBreakdown[] = session.rounds.map((round) => {
    const latestSubmission = round.bestSubmission ?? round.submissions[0] ?? null;
    const skipped = isSkipped(round.metadata);

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
  });

  return {
    id: session.id,
    status: session.status.toLowerCase() as GameSessionResult["status"],
    mode: session.mode.toLowerCase() as GameSessionResult["mode"],
    score: session.totalScore,
    solvedCount: session.promptsCorrect,
    attemptedCount: session.promptsAttempted,
    accuracy: calculateAccuracy(session.promptsCorrect, session.promptsAttempted),
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    durationMs: session.timeLimitMs ?? PRACTICE_DURATION_MS,
    rounds
  };
}

export async function ensureSessionProgression(sessionId: string) {
  await expireSessionIfNeeded(sessionId);

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

  if (!latestRound) {
    return;
  }

  if (!latestRound.resolvedAt) {
    return;
  }

  const challengeIds = getChallengeIds(session.metadata);
  const nextIndex = latestRound.position;

  if (nextIndex >= challengeIds.length) {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        status: "COMPLETED",
        endedAt: new Date()
      }
    });
    return;
  }

  const nextRoundExists = await prisma.gameRound.findFirst({
    where: {
      gameSessionId: sessionId,
      position: latestRound.position + 1
    }
  });

  if (nextRoundExists) {
    return;
  }

  await prisma.gameRound.create({
    data: {
      gameSessionId: sessionId,
      challengeId: challengeIds[nextIndex]!,
      position: latestRound.position + 1
    }
  });
}

async function getGameSessionStateOrThrow(sessionId: string): Promise<GameSessionState> {
  const session = await prisma.gameSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      rounds: {
        orderBy: { position: "asc" },
        include: {
          challenge: {
            include: {
              category: true,
              canonicalArtifact: true
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
  });

  const endsAt = new Date(session.startedAt.getTime() + (session.timeLimitMs ?? PRACTICE_DURATION_MS));
  const timeRemainingMs = Math.max(0, endsAt.getTime() - Date.now());
  const currentRound = session.status === "ACTIVE" ? session.rounds.find((round) => !round.resolvedAt) ?? null : null;
  const latestResolved = [...session.rounds].reverse().find((round) => round.resolvedAt);

  return {
    id: session.id,
    status: session.status.toLowerCase() as GameSessionState["status"],
    mode: session.mode.toLowerCase() as GameSessionState["mode"],
    startedAt: session.startedAt.toISOString(),
    endsAt: endsAt.toISOString(),
    durationMs: session.timeLimitMs ?? PRACTICE_DURATION_MS,
    timeRemainingMs,
    score: session.totalScore,
    solvedCount: session.promptsCorrect,
    attemptedCount: session.promptsAttempted,
    accuracy: calculateAccuracy(session.promptsCorrect, session.promptsAttempted),
    streak: calculateCurrentStreak(session.rounds),
    currentRound: currentRound ? toRoundPayload(session.id, session.totalScore, calculateCurrentStreak(session.rounds), currentRound, timeRemainingMs) : null,
    lastResult: latestResolved
      ? {
          verdict:
            isSkipped(latestResolved.metadata)
              ? "skipped"
              : latestResolved.finalVerdict === "CORRECT"
                ? "correct"
                : latestResolved.finalVerdict === "COMPILE_ERROR"
                  ? "compile_error"
                  : "incorrect",
          matchTier: mapMatchTier(latestResolved.finalMatchTier),
          scoreAwarded: latestResolved.scoreAwarded,
          feedback:
            latestResolved.bestSubmission?.feedback ??
            latestResolved.submissions[0]?.feedback ??
            (isSkipped(latestResolved.metadata) ? "Skipped by player." : "Round resolved.")
        }
      : null
  };
}

async function expireSessionIfNeeded(sessionId: string) {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId }
  });

  if (!session || session.status !== "ACTIVE") {
    return;
  }

  const endsAt = session.startedAt.getTime() + (session.timeLimitMs ?? PRACTICE_DURATION_MS);

  if (Date.now() < endsAt) {
    return;
  }

  await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      status: "COMPLETED",
      endedAt: new Date(endsAt)
    }
  });
}

function toRoundPayload(
  sessionId: string,
  score: number,
  streak: number,
  round: {
    id: string;
    position: number;
    challenge: {
      id: string;
      slug: string;
      title: string;
      difficulty: number;
      category: { slug: string };
      canonicalArtifact: { svgInline: string | null; normalizedSvgHash: string } | null;
    };
  },
  timeRemainingMs: number
): ChallengeRoundPayload {
  return {
    sessionId,
    roundId: round.id,
    score,
    streak,
    roundNumber: round.position,
    timeRemainingMs,
    challenge: {
      id: round.challenge.id,
      slug: round.challenge.slug,
      title: round.challenge.title,
      category: round.challenge.category.slug as ChallengeRoundPayload["challenge"]["category"],
      difficulty: difficultyToLabel(round.challenge.difficulty),
      inputMode: round.challenge.category.slug === "text-formatting" ? "text" : "math",
      renderedSvg: round.challenge.canonicalArtifact?.svgInline ?? "",
      renderHash: round.challenge.canonicalArtifact?.normalizedSvgHash
    }
  };
}

function assertSessionAccess(
  session: {
    userId: string | null;
    playerSessionId: string;
  },
  actor: SessionActor
) {
  if (actor.userId && session.userId === actor.userId) {
    return;
  }

  if (actor.playerSessionId && session.playerSessionId === actor.playerSessionId) {
    return;
  }

  throw new Error("Session not accessible.");
}

function difficultyToLabel(difficulty: number): ChallengeDifficulty {
  if (difficulty <= 1) return "easy";
  if (difficulty === 2) return "medium";
  return "hard";
}

function calculateAccuracy(correct: number, attempted: number) {
  if (attempted === 0) return 0;
  return correct / attempted;
}

function calculateCurrentStreak(
  rounds: Array<{
    finalVerdict: "CORRECT" | "INCORRECT" | "COMPILE_ERROR" | "TIMEOUT" | null;
    resolvedAt: Date | null;
    metadata: unknown;
  }>
) {
  let streak = 0;

  for (let index = rounds.length - 1; index >= 0; index -= 1) {
    const round = rounds[index]!;

    if (!round.resolvedAt) {
      continue;
    }

    if (round.finalVerdict === "CORRECT") {
      streak += 1;
      continue;
    }

    break;
  }

  return streak;
}

function mapVerdict(verdict: "CORRECT" | "INCORRECT" | "COMPILE_ERROR" | "TIMEOUT" | null): RoundBreakdown["verdict"] {
  if (!verdict) return "pending";
  return verdict.toLowerCase() as SubmissionVerdict;
}

function mapMatchTier(tier: "EXACT" | "NORMALIZED" | "RENDERED" | "ALTERNATE" | "NONE" | null): MatchTier {
  if (!tier) return "none";
  return tier.toLowerCase() as MatchTier;
}

function getChallengeIds(metadata: Prisma.JsonValue): string[] {
  if (!metadata || typeof metadata !== "object" || !("challengeIds" in metadata)) {
    return [];
  }

  const challengeIds = (metadata as { challengeIds?: unknown }).challengeIds;
  return Array.isArray(challengeIds) ? challengeIds.filter((value): value is string => typeof value === "string") : [];
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex]!, copy[index]!];
  }

  return copy;
}

function isSkipped(metadata: unknown) {
  return Boolean(metadata && typeof metadata === "object" && "skipped" in metadata && (metadata as { skipped?: unknown }).skipped);
}
