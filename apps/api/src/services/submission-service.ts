import { normalizeSource, runStaticCheck } from "@typ-nique/checker";
import type { SubmissionOutcome } from "@typ-nique/types";
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { renderQueue } from "../lib/queue.js";
import { getChallengeById } from "./challenge-service.js";
import { ensureSessionProgression, getGameSessionState } from "./game-service.js";

const RENDER_WAIT_TIMEOUT_MS = 4500;
const RENDER_WAIT_INTERVAL_MS = 150;

export async function submitAttempt(input: {
  sessionId: string;
  roundId: string;
  source: string;
}): Promise<SubmissionOutcome> {
  const round = await prisma.gameRound.findUnique({
    where: { id: input.roundId },
    include: { challenge: true, gameSession: true }
  });

  if (!round || round.gameSessionId !== input.sessionId) {
    throw new Error("Round not found for session.");
  }

  if (round.gameSession.status !== "ACTIVE") {
    const sessionState = await getGameSessionState(input.sessionId);

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
    const scoreAwarded = scoreSubmission(round.challenge.difficulty, round.presentedAt);

    await prisma.gameRound.update({
      where: { id: round.id },
      data: {
        scoreAwarded,
        bestSubmissionId: submission.id,
        finalVerdict: "CORRECT",
        finalMatchTier: staticResult.matchTier.toUpperCase() as
          | "EXACT"
          | "NORMALIZED"
          | "RENDERED"
          | "ALTERNATE"
          | "NONE",
        resolvedAt: new Date(),
        timeTakenMs: Date.now() - round.presentedAt.getTime()
      }
    });

    await prisma.gameSession.update({
      where: { id: round.gameSessionId },
      data: {
        totalScore: { increment: scoreAwarded },
        promptsAttempted: { increment: 1 },
        promptsCorrect: { increment: 1 }
      }
    });

    await prisma.scoreRecord.create({
      data: {
        gameSessionId: round.gameSessionId,
        gameRoundId: round.id,
        userId: round.gameSession.userId,
        scoreType: "ROUND",
        points: scoreAwarded,
        metadata: {
          matchTier: staticResult.matchTier,
          difficulty: round.challenge.difficulty
        }
      }
    });

    await ensureSessionProgression(round.gameSessionId);
    const sessionState = await getGameSessionState(round.gameSessionId);

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
  const sessionState = await getGameSessionState(round.gameSessionId);

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
    sessionState: sessionState ?? undefined
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

function scoreSubmission(
  difficulty: number,
  presentedAt: Date
) {
  const difficultyBase = difficulty <= 1 ? 100 : difficulty === 2 ? 150 : 220;
  const elapsedSeconds = Math.max(1, (Date.now() - presentedAt.getTime()) / 1000);
  const speedBonus = Math.max(0.55, Math.min(1.25, 20 / elapsedSeconds));

  return Math.round(difficultyBase * speedBonus);
}
