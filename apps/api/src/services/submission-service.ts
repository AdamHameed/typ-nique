import { compareRenderedOutput, normalizeSource, runStaticCheck } from "@typ-nique/checker";
import { normalizeSvgMarkup, svgFingerprint } from "@typ-nique/typst-utils";
import type { MatchTier, PreviewRenderResponse, SubmissionOutcome } from "@typ-nique/types";
import { createHash } from "node:crypto";
import { env } from "../lib/env.js";
import { prisma } from "../lib/prisma.js";
import { renderQueue } from "../lib/queue.js";
import { getChallengeById } from "./challenge-service.js";
import { ensureSessionProgression, getGameSessionState } from "./game-service.js";
import { scoreSubmission } from "./scoring.js";

const RENDER_WAIT_TIMEOUT_MS = 4500;
const RENDER_WAIT_INTERVAL_MS = 150;

export async function submitAttempt(input: {
  sessionId: string;
  roundId: string;
  source: string;
  actor: {
    userId: string | null;
    playerSessionId: string | null;
  };
}): Promise<SubmissionOutcome> {
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
    throw new Error("Round not accessible.");
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
      rawSource: input.source,
      normalizedSource: normalizeSource(input.source),
      sourceHash: createHash("sha256").update(input.source).digest("hex"),
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
        difficulty: round.challenge.difficulty,
        source: "static"
      }
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
    if (directRenderResult.verdict === "correct") {
      const { scoreAwarded, sessionState } = await acceptResolvedSubmission({
        round,
        submissionId: submission.id,
        matchTier: directRenderResult.matchTier,
        actor: input.actor,
        incrementAttempted: false,
        scoreMetadata: {
          matchTier: directRenderResult.matchTier,
          difficulty: round.challenge.difficulty,
          source: "direct-render"
        }
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
    presentedAt: Date;
    challenge: {
      difficulty: number;
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
  const scoreAwarded = scoreSubmission(input.round.challenge.difficulty, input.round.presentedAt);

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
        ...(input.scoreMetadata ?? {})
      }
    }
  });

  await ensureSessionProgression(input.round.gameSessionId);
  const sessionState = await getGameSessionState(input.round.gameSessionId, input.actor);

  return {
    scoreAwarded,
    sessionState
  };
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
