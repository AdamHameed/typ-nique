import { compareRenderedOutput, normalizeSource, runStaticCheck } from "@typ-nique/checker";
import { normalizeSvgMarkup, svgFingerprint } from "@typ-nique/typst-utils";
import {
  calculateStreakMultiplier,
  calculateTypstSourceBasePoints,
  type MatchTier,
  type PreviewRenderResponse,
  type SubmissionOutcome
} from "@typ-nique/types";
import { createHash } from "node:crypto";
import { env } from "../lib/env.js";
import { buildRateLimitKey, checkRateLimit } from "../lib/rate-limit.js";
import { logSecurityEvent } from "../lib/security-observability.js";
import { prisma } from "../lib/prisma.js";
import { renderQueue } from "../lib/queue.js";
import { getChallengeById } from "./challenge-service.js";
import { ensureSessionProgression, getGameSessionState } from "./game-service.js";
import { notifyMultiplayerRoundResolved } from "./multiplayer-service.js";
import { scoreSubmission } from "./scoring.js";
import { buildDuplicateSubmissionOutcome as buildDuplicateSubmissionOutcomeFromRecord } from "./submission-dedup.js";

const RENDER_WAIT_TIMEOUT_MS = 4500;
const RENDER_WAIT_INTERVAL_MS = 150;
const DUPLICATE_SUBMISSION_WINDOW_MS = 10_000;
const SUSPICIOUS_FAST_SOLVE_MS = 750;
const MULTIPLAYER_SUBMISSION_RATE_LIMIT_WINDOW_MS = 30_000;
const MULTIPLAYER_SUBMISSION_RATE_LIMIT_MAX = 18;
const COMPILE_SPAM_LOOKBACK_MS = 60_000;
const COMPILE_SPAM_THRESHOLD = 5;

export async function submitAttempt(input: {
  sessionId: string;
  roundId: string;
  source: string;
  actor: {
    userId: string | null;
    playerSessionId: string | null;
  };
}): Promise<SubmissionOutcome> {
  const trimmedSource = input.source.trim();
  const normalizedSource = normalizeSource(trimmedSource);
  const sourceHash = createHash("sha256").update(trimmedSource).digest("hex");
  const round = await prisma.gameRound.findUnique({
    where: { id: input.roundId },
    include: { challenge: true, gameSession: true }
  });

  if (!round || round.gameSessionId !== input.sessionId) {
    throw new Error("Round not found for session.");
  }

  if (
    !(input.actor.userId && round.gameSession.userId === input.actor.userId) &&
    !(input.actor.playerSessionId && round.gameSession.playerSessionId === input.actor.playerSessionId)
  ) {
    await auditSuspiciousSubmissionPattern("round-access-denied", {
      sessionId: input.sessionId,
      roundId: input.roundId,
      actor: input.actor
    });
    throw new Error("Round not accessible.");
  }

  if (round.gameSession.matchId) {
    await assertMultiplayerSubmissionAccess(round.gameSession.matchId, round.gameSessionId, input.actor);
    enforceMultiplayerSubmissionRateLimit(round.gameSession.matchId, input.actor);
  }

  if (round.gameSession.status !== "ACTIVE") {
    const sessionState = await getGameSessionState(input.sessionId, input.actor);

    return {
      verdict: "incorrect",
      matchTier: "none",
      normalizedSource: normalizeSource(input.source),
      feedback: "This session is no longer active.",
      explanation: "The game session has already ended.",
      sessionState: sessionState ?? undefined
    };
  }

  const duplicateSubmission = await findDuplicateSubmission(round.id, sourceHash);

  if (duplicateSubmission) {
    await auditSuspiciousSubmissionPattern("duplicate-submission", {
      sessionId: round.gameSessionId,
      roundId: round.id,
      actor: input.actor,
      attemptNumber: duplicateSubmission.attemptNumber
    });

    return buildDuplicateSubmissionOutcome({
      submission: duplicateSubmission,
      source: trimmedSource,
      actor: input.actor,
      sessionId: round.gameSessionId
    });
  }

  const prompt = await getChallengeById(round.challengeId);

  if (!prompt) {
    throw new Error("Challenge not found.");
  }

  const staticResult = runStaticCheck(input.source, prompt);
  const attemptNumber = (await prisma.submission.count({ where: { gameRoundId: round.id } })) + 1;

  const submission = await prisma.submission.create({
    data: {
      gameRoundId: round.id,
      attemptNumber,
      rawSource: trimmedSource,
      normalizedSource,
      sourceHash,
      checkerVersion: 1,
      verdict: staticResult.verdict === "correct" ? "CORRECT" : "INCORRECT",
      matchTier: staticResult.matchTier.toUpperCase() as
        | "EXACT"
        | "NORMALIZED"
        | "RENDERED"
        | "ALTERNATE"
        | "NONE",
      isAccepted: staticResult.verdict === "correct",
      feedback: staticResult.feedback
    }
  });

  if (staticResult.verdict === "correct") {
    const { scoreAwarded, sessionState } = await acceptResolvedSubmission({
      round,
      submissionId: submission.id,
      matchTier: staticResult.matchTier,
      actor: input.actor,
      incrementAttempted: true,
      scoreMetadata: {
        source: "static"
      }
    });

    await auditResolvedSubmission(round, {
      matchTier: staticResult.matchTier,
      source: "static",
      attemptNumber
    });

    return {
      ...staticResult,
      explanation: staticResult.feedback,
      queuedRenderCheck: false,
      scoreAwarded,
      sessionState: sessionState ?? undefined
    };
  }

  await prisma.gameSession.update({
    where: { id: round.gameSessionId },
    data: {
      promptsAttempted: { increment: 1 }
    }
  });

  const directRenderResult = await attemptDirectRenderValidation({
    source: input.source,
    inputMode: prompt.inputMode,
    prompt,
    submissionId: submission.id
  });

  if (directRenderResult) {
    if (directRenderResult.verdict === "compile_error") {
      await auditCompileSpam(round.gameSessionId, round.id, round.gameSession.matchId, input.actor);
    }

    if (directRenderResult.verdict === "correct") {
      const { scoreAwarded, sessionState } = await acceptResolvedSubmission({
        round,
        submissionId: submission.id,
        matchTier: directRenderResult.matchTier,
        actor: input.actor,
        incrementAttempted: false,
        scoreMetadata: {
          matchTier: directRenderResult.matchTier,
          source: "direct-render"
        }
      });

      await auditResolvedSubmission(round, {
        matchTier: directRenderResult.matchTier,
        source: "direct-render",
        attemptNumber
      });

      return {
        ...directRenderResult,
        explanation: directRenderResult.feedback,
        queuedRenderCheck: false,
        scoreAwarded,
        sessionState: sessionState ?? undefined
      };
    }

    return {
      ...directRenderResult,
      explanation: directRenderResult.feedback,
      queuedRenderCheck: false,
      scoreAwarded: 0
    };
  }

  const job = await renderQueue.add("render-check", {
    submissionId: submission.id,
    roundId: round.id,
    source: input.source,
    canonicalSource: round.challenge.canonicalSource,
    canonicalSvg: prompt.renderedSvg ?? "",
    acceptedAlternates: prompt.acceptedAlternates
  });

  const resolvedSubmission = await waitForRenderVerdict(submission.id);

  if (!resolvedSubmission) {
    return {
      verdict: staticResult.verdict,
      matchTier: staticResult.matchTier,
      normalizedSource: staticResult.normalizedSource,
      feedback: `Submission queued for render comparison (job ${job.id}).`,
      explanation: "Static checks failed, so the answer is waiting for rendered SVG equivalence validation.",
      queuedRenderCheck: true
    };
  }

  if (resolvedSubmission.verdict === "CORRECT") {
    await prisma.gameRound.update({
      where: { id: round.id },
      data: {
        timeTakenMs: Date.now() - round.presentedAt.getTime()
      }
    });

    await ensureSessionProgression(round.gameSessionId);

    if (round.gameSession.matchId) {
      await notifyMultiplayerRoundResolved(round.gameSession.matchId, {
        sessionId: round.gameSessionId,
        roundId: round.id,
        reason: "worker-round-resolved"
      });
    }

    await auditResolvedSubmission(round, {
      matchTier: resolvedSubmission.matchTier.toLowerCase() as MatchTier,
      source: "worker",
      attemptNumber
    });
  }

  if (resolvedSubmission.verdict === "COMPILE_ERROR") {
    await auditCompileSpam(round.gameSessionId, round.id, round.gameSession.matchId, input.actor);
  }

  const refreshedRound = await prisma.gameRound.findUnique({
    where: { id: round.id }
  });
  const ownedSessionState = await getGameSessionState(round.gameSessionId, input.actor);

  return {
    verdict: resolvedSubmission.verdict.toLowerCase() as SubmissionOutcome["verdict"],
    matchTier: resolvedSubmission.matchTier.toLowerCase() as SubmissionOutcome["matchTier"],
    normalizedSource: resolvedSubmission.normalizedSource,
    feedback: resolvedSubmission.feedback ?? "Rendered validation completed.",
    explanation: resolvedSubmission.feedback ?? "Rendered validation completed.",
    compileError: resolvedSubmission.compileError ?? undefined,
    renderFingerprint: resolvedSubmission.renderFingerprint ?? undefined,
    queuedRenderCheck: false,
    scoreAwarded: resolvedSubmission.verdict === "CORRECT" ? refreshedRound?.scoreAwarded ?? undefined : 0,
    sessionState: ownedSessionState ?? undefined
  };
}

async function attemptDirectRenderValidation(input: {
  source: string;
  inputMode: "math" | "text";
  prompt: NonNullable<Awaited<ReturnType<typeof getChallengeById>>>;
  submissionId: string;
}): Promise<
  | Pick<SubmissionOutcome, "verdict" | "matchTier" | "normalizedSource" | "feedback" | "compileError" | "renderFingerprint">
  | null
> {
  let response: Response;

  try {
    response = await fetch(`${env.WORKER_RENDER_URL}/internal/render/preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.WORKER_INTERNAL_TOKEN ? { "x-worker-internal-token": env.WORKER_INTERNAL_TOKEN } : {})
      },
      body: JSON.stringify({
        source: input.source,
        inputMode: input.inputMode
      })
    });
  } catch {
    return null;
  }

  let payload: PreviewRenderResponse | null = null;

  try {
    payload = (await response.json()) as PreviewRenderResponse;
  } catch {
    return null;
  }

  if (!response.ok) {
    if (response.status !== 422) {
      return null;
    }

    const feedback = payload?.message ?? "Typst could not compile that submission.";

    await prisma.submission.update({
      where: { id: input.submissionId },
      data: {
        verdict: "COMPILE_ERROR",
        matchTier: "NONE",
        feedback,
        compileError: feedback,
        isAccepted: false,
        compileDurationMs: payload?.durationMs,
        renderMetadata: {
          errorCode: payload?.errorCode ?? "PREVIEW_FAILED",
          cached: payload?.cached ?? false,
          source: "direct-render"
        }
      }
    });

    return {
      verdict: "compile_error",
      matchTier: "none",
      normalizedSource: normalizeSource(input.source),
      feedback,
      compileError: feedback
    };
  }

  if (!payload?.ok || !payload.svg) {
    return null;
  }

  const comparison = compareRenderedOutput({
    submissionSource: input.source,
    canonicalPrompt: input.prompt,
    renderedSvg: payload.svg
  });

  await prisma.submission.update({
    where: { id: input.submissionId },
    data: {
      verdict:
        comparison.verdict === "correct"
          ? "CORRECT"
          : comparison.verdict === "compile_error"
            ? "COMPILE_ERROR"
            : "INCORRECT",
      matchTier: comparison.matchTier.toUpperCase() as "EXACT" | "NORMALIZED" | "RENDERED" | "ALTERNATE" | "NONE",
      feedback: comparison.feedback,
      isAccepted: comparison.verdict === "correct",
      renderFingerprint: comparison.renderFingerprint ?? payload.renderHash,
      compileError: comparison.compileError ?? null,
      compileDurationMs: payload.durationMs,
      renderMetadata: {
        cached: payload.cached ?? false,
        autoWrappedMath: payload.autoWrappedMath ?? false,
        source: "direct-render"
      },
      renderArtifact: {
        upsert: {
          update: {
            svgInline: payload.svg,
            normalizedSvgHash: svgFingerprint(normalizeSvgMarkup(payload.svg))
          },
          create: {
            svgInline: payload.svg,
            normalizedSvgHash: svgFingerprint(normalizeSvgMarkup(payload.svg))
          }
        }
      }
    }
  });

  return {
    verdict: comparison.verdict,
    matchTier: comparison.matchTier,
    normalizedSource: comparison.normalizedSource,
    feedback: comparison.feedback,
    compileError: comparison.compileError,
    renderFingerprint: comparison.renderFingerprint ?? payload.renderHash
  };
}

async function acceptResolvedSubmission(input: {
  round: {
    id: string;
    gameSessionId: string;
    position: number;
    presentedAt: Date;
    challenge: {
      canonicalSource: string;
    };
    gameSession: {
      userId: string | null;
    };
  };
  submissionId: string;
  matchTier: MatchTier;
  actor: {
    userId: string | null;
    playerSessionId: string | null;
  };
  incrementAttempted: boolean;
  scoreMetadata?: Record<string, unknown>;
}) {
  const streak = await getSessionStreakBeforeRound(input.round.gameSessionId, input.round.position);
  const basePoints = calculateTypstSourceBasePoints(input.round.challenge.canonicalSource);
  const streakMultiplier = calculateStreakMultiplier(streak);
  const scoreAwarded = scoreSubmission(input.round.challenge.canonicalSource, streak);

  await prisma.gameRound.update({
    where: { id: input.round.id },
    data: {
      scoreAwarded,
      bestSubmissionId: input.submissionId,
      finalVerdict: "CORRECT",
      finalMatchTier: input.matchTier.toUpperCase() as "EXACT" | "NORMALIZED" | "RENDERED" | "ALTERNATE" | "NONE",
      resolvedAt: new Date(),
      timeTakenMs: Date.now() - input.round.presentedAt.getTime()
    }
  });

  await prisma.gameSession.update({
    where: { id: input.round.gameSessionId },
    data: {
      totalScore: { increment: scoreAwarded },
      ...(input.incrementAttempted ? { promptsAttempted: { increment: 1 } } : {}),
      promptsCorrect: { increment: 1 }
    }
  });

  await prisma.scoreRecord.create({
    data: {
      gameSessionId: input.round.gameSessionId,
      gameRoundId: input.round.id,
      userId: input.round.gameSession.userId,
      scoreType: "ROUND",
      points: scoreAwarded,
      metadata: {
        matchTier: input.matchTier,
        basePoints,
        streak,
        streakMultiplier,
        ...(input.scoreMetadata ?? {})
      }
    }
  });

  await ensureSessionProgression(input.round.gameSessionId);
  const refreshedSession = await prisma.gameSession.findUnique({
    where: { id: input.round.gameSessionId },
    select: { matchId: true }
  });

  if (refreshedSession?.matchId) {
    await notifyMultiplayerRoundResolved(refreshedSession.matchId, {
      sessionId: input.round.gameSessionId,
      roundId: input.round.id,
      reason: "submission-accepted"
    });
  }

  const sessionState = await getGameSessionState(input.round.gameSessionId, input.actor);

  return {
    scoreAwarded,
    sessionState
  };
}

async function getSessionStreakBeforeRound(sessionId: string, roundPosition: number) {
  const priorRounds = await prisma.gameRound.findMany({
    where: {
      gameSessionId: sessionId,
      position: {
        lt: roundPosition
      },
      resolvedAt: {
        not: null
      }
    },
    orderBy: {
      position: "desc"
    },
    select: {
      finalVerdict: true,
      metadata: true
    }
  });

  let streak = 0;

  for (const round of priorRounds) {
    const skipped = Boolean(
      round.metadata && typeof round.metadata === "object" && "skipped" in round.metadata && (round.metadata as { skipped?: unknown }).skipped
    );

    if (round.finalVerdict === "CORRECT" && !skipped) {
      streak += 1;
      continue;
    }

    break;
  }

  return streak;
}

async function waitForRenderVerdict(submissionId: string) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < RENDER_WAIT_TIMEOUT_MS) {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId }
    });

    if (
      submission &&
      (submission.verdict === "CORRECT" ||
        submission.verdict === "COMPILE_ERROR" ||
        (submission.verdict === "INCORRECT" && submission.renderFingerprint !== null))
    ) {
      return submission;
    }

    await new Promise((resolve) => setTimeout(resolve, RENDER_WAIT_INTERVAL_MS));
  }

  return null;
}

async function assertMultiplayerSubmissionAccess(
  matchId: string,
  gameSessionId: string,
  actor: {
    userId: string | null;
    playerSessionId: string | null;
  }
) {
  const membership = await prisma.multiplayerMatchPlayer.findFirst({
    where: {
      matchId,
      leftAt: null,
      ...(actor.userId ? { userId: actor.userId } : { playerSessionId: actor.playerSessionId ?? undefined })
    }
  });

  if (!membership || membership.gameSessionId !== gameSessionId) {
    await auditSuspiciousSubmissionPattern("multiplayer-membership-mismatch", {
      matchId,
      sessionId: gameSessionId,
      actor
    });
    throw new Error("Round not accessible.");
  }
}

function enforceMultiplayerSubmissionRateLimit(
  matchId: string,
  actor: {
    userId: string | null;
    playerSessionId: string | null;
  }
) {
  const limiter = checkRateLimit(
    buildRateLimitKey(`multiplayer-submission:${matchId}`, actor.userId ?? actor.playerSessionId, "anonymous"),
    Math.min(env.SUBMISSION_RATE_LIMIT_MAX, MULTIPLAYER_SUBMISSION_RATE_LIMIT_MAX),
    Math.min(env.SUBMISSION_RATE_LIMIT_WINDOW_MS, MULTIPLAYER_SUBMISSION_RATE_LIMIT_WINDOW_MS)
  );

  if (!limiter.allowed) {
    void auditSuspiciousSubmissionPattern("multiplayer-rate-limit-exceeded", {
      matchId,
      actor,
      limit: Math.min(env.SUBMISSION_RATE_LIMIT_MAX, MULTIPLAYER_SUBMISSION_RATE_LIMIT_MAX),
      windowMs: Math.min(env.SUBMISSION_RATE_LIMIT_WINDOW_MS, MULTIPLAYER_SUBMISSION_RATE_LIMIT_WINDOW_MS)
    });
    throw new Error("Multiplayer submission rate limit reached.");
  }
}

async function findDuplicateSubmission(roundId: string, sourceHash: string) {
  const submission = await prisma.submission.findFirst({
    where: {
      gameRoundId: roundId,
      sourceHash
    },
    orderBy: { submittedAt: "desc" }
  });

  if (!submission) {
    return null;
  }

  return Date.now() - submission.submittedAt.getTime() <= DUPLICATE_SUBMISSION_WINDOW_MS ? submission : null;
}

async function buildDuplicateSubmissionOutcome(input: {
  submission: {
    verdict: "CORRECT" | "INCORRECT" | "COMPILE_ERROR" | "TIMEOUT";
    matchTier: "EXACT" | "NORMALIZED" | "RENDERED" | "ALTERNATE" | "NONE";
    normalizedSource: string;
    feedback: string | null;
    compileError: string | null;
    renderFingerprint: string | null;
    isAccepted: boolean;
  };
  source: string;
  actor: {
    userId: string | null;
    playerSessionId: string | null;
  };
  sessionId: string;
}): Promise<SubmissionOutcome> {
  const sessionState = await getGameSessionState(input.sessionId, input.actor);
  return buildDuplicateSubmissionOutcomeFromRecord({
    submission: input.submission,
    sessionState: sessionState ?? undefined
  });
}

async function auditResolvedSubmission(
  round: {
    id: string;
    gameSessionId: string;
    presentedAt: Date;
    gameSession: {
      matchId: string | null;
    };
  },
  input: {
    matchTier: MatchTier;
    source: "static" | "direct-render" | "worker";
    attemptNumber: number;
  }
) {
  const elapsedMs = Date.now() - round.presentedAt.getTime();

  if (elapsedMs <= SUSPICIOUS_FAST_SOLVE_MS) {
    await auditSuspiciousSubmissionPattern("suspicious-fast-solve", {
      sessionId: round.gameSessionId,
      roundId: round.id,
      matchId: round.gameSession.matchId,
      elapsedMs,
      source: input.source,
      matchTier: input.matchTier,
      attemptNumber: input.attemptNumber
    });
  }

  if (input.attemptNumber >= 12) {
    await auditSuspiciousSubmissionPattern("high-attempt-volume", {
      sessionId: round.gameSessionId,
      roundId: round.id,
      matchId: round.gameSession.matchId,
      attemptNumber: input.attemptNumber,
      source: input.source
    });
  }
}

async function auditCompileSpam(
  sessionId: string,
  roundId: string,
  matchId: string | null,
  actor: {
    userId: string | null;
    playerSessionId: string | null;
  }
) {
  const compileErrors = await prisma.submission.count({
    where: {
      gameRound: {
        gameSessionId: sessionId
      },
      verdict: "COMPILE_ERROR",
      submittedAt: {
        gte: new Date(Date.now() - COMPILE_SPAM_LOOKBACK_MS)
      }
    }
  });

  if (compileErrors >= COMPILE_SPAM_THRESHOLD) {
    await auditSuspiciousSubmissionPattern("compile-spam", {
      matchId,
      sessionId,
      roundId,
      actor,
      compileErrors,
      lookbackMs: COMPILE_SPAM_LOOKBACK_MS
    });
  }
}

async function auditSuspiciousSubmissionPattern(event: string, payload: Record<string, unknown>) {
  logSecurityEvent(event, payload, "warn");
}
