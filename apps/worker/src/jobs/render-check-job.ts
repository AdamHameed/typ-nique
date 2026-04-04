import { compareRenderedOutput, normalizeSource } from "@typ-nique/checker";
import { normalizeSvgMarkup, svgFingerprint } from "@typ-nique/typst-utils";
import { prisma } from "@typ-nique/db";
import { enqueueRenderCheckSchema } from "@typ-nique/validation";
import { compileTypstToSvg } from "../lib/typst-runner.js";

export async function handleRenderCheckJob(payload: unknown) {
  const job = enqueueRenderCheckSchema.parse(payload);
  const compileResult = await compileTypstToSvg(job.source, `job:${job.submissionId}`);

  if (!compileResult.ok) {
    await prisma.submission.update({
      where: { id: job.submissionId },
      data: {
        verdict: "COMPILE_ERROR",
        feedback: "Typst could not compile that submission.",
        compileError: compileResult.error,
        isAccepted: false,
        compileDurationMs: compileResult.durationMs,
        renderMetadata: {
          errorCode: compileResult.errorCode,
          cached: compileResult.cached
        }
      }
    });

    return {
      status: "compile_error",
      roundId: job.roundId
    };
  }

  const comparison = compareRenderedOutput({
    submissionSource: job.source,
    canonicalPrompt: {
      id: job.roundId,
      slug: "job-derived",
      title: "Render job",
      category: "basic-math",
      difficulty: "easy",
      inputMode: "math",
      canonicalSource: job.canonicalSource,
      normalizedCanonicalSource: normalizeSource(job.canonicalSource),
      renderedSvg: job.canonicalSvg,
      acceptedAlternates: job.acceptedAlternates
    },
    renderedSvg: compileResult.svg
  });

  await prisma.submission.update({
    where: { id: job.submissionId },
    data: {
      verdict:
        comparison.verdict === "correct"
          ? "CORRECT"
          : comparison.verdict === "compile_error"
            ? "COMPILE_ERROR"
            : "INCORRECT",
      matchTier: comparison.matchTier.toUpperCase() as
        | "EXACT"
        | "NORMALIZED"
        | "RENDERED"
          | "ALTERNATE"
          | "NONE",
      feedback: comparison.feedback,
      isAccepted: comparison.verdict === "correct",
      renderFingerprint: comparison.renderFingerprint ?? compileResult.renderHash,
      compileError: comparison.compileError ?? null,
      compileDurationMs: compileResult.durationMs,
      renderMetadata: {
        svgLength: compileResult.svg.length,
        cached: compileResult.cached
      },
      renderArtifact: {
        upsert: {
          update: {
            svgInline: compileResult.svg,
            normalizedSvgHash: svgFingerprint(normalizeSvgMarkup(compileResult.svg))
          },
          create: {
            svgInline: compileResult.svg,
            normalizedSvgHash: svgFingerprint(normalizeSvgMarkup(compileResult.svg))
          }
        }
      }
    }
  });

  if (comparison.verdict === "correct") {
    const round = await prisma.gameRound.findUniqueOrThrow({
      where: { id: job.roundId },
      include: { gameSession: true, challenge: true }
    });

    await prisma.gameRound.update({
      where: { id: job.roundId },
      data: {
        bestSubmissionId: job.submissionId,
        finalVerdict: "CORRECT",
        finalMatchTier: comparison.matchTier.toUpperCase() as
          | "EXACT"
          | "NORMALIZED"
          | "RENDERED"
          | "ALTERNATE"
          | "NONE",
        resolvedAt: new Date()
      }
    });

    const points = scoreSubmission(round.challenge.difficulty, round.presentedAt);

    await prisma.gameSession.update({
      where: { id: round.gameSessionId },
      data: {
        totalScore: { increment: points },
        promptsCorrect: { increment: 1 }
      }
    });

    await prisma.gameRound.update({
      where: { id: round.id },
      data: {
        scoreAwarded: points,
        timeTakenMs: Date.now() - round.presentedAt.getTime()
      }
    });

    await prisma.scoreRecord.create({
      data: {
        gameSessionId: round.gameSessionId,
        gameRoundId: round.id,
        userId: round.gameSession.userId,
        scoreType: "ROUND",
        points,
        metadata: {
          matchTier: comparison.matchTier,
          source: "worker"
        }
      }
    });
  }

  return {
    status: comparison.verdict,
    roundId: job.roundId,
    matchTier: comparison.matchTier
  };
}

function scoreSubmission(difficulty: number, presentedAt: Date) {
  const difficultyBase = difficulty <= 1 ? 100 : difficulty === 2 ? 150 : 220;
  const elapsedSeconds = Math.max(1, (Date.now() - presentedAt.getTime()) / 1000);
  const speedBonus = Math.max(0.55, Math.min(1.25, 20 / elapsedSeconds));

  return Math.round(difficultyBase * speedBonus);
}
