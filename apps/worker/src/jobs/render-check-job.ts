import { compareRenderedOutput } from "@typ-nique/checker";
import { normalizeSource, normalizeSvgMarkup, svgFingerprint } from "@typ-nique/typst-utils";
import { prisma } from "@typ-nique/db";
import { enqueueRenderCheckSchema } from "@typ-nique/validation";
import { compileTypstToSvg } from "../lib/typst-runner.js";

export async function handleRenderCheckJob(payload: unknown) {
  const job = enqueueRenderCheckSchema.parse(payload);
  const compileResult = await compileTypstToSvg(job.source);

  if (!compileResult.ok) {
    await prisma.submission.update({
      where: { id: job.submissionId },
      data: {
        verdict: "COMPILE_ERROR",
        feedback: compileResult.error,
        compileError: compileResult.error,
        isAccepted: false,
        compileDurationMs: compileResult.durationMs,
        renderMetadata: {
          errorCode: compileResult.errorCode,
          cached: compileResult.cached
        }
      }
    });

    await prisma.gameRound.update({
      where: { id: job.roundId },
      data: {
        finalVerdict: "COMPILE_ERROR",
        finalMatchTier: "NONE",
        resolvedAt: new Date()
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

  await prisma.gameRound.update({
    where: { id: job.roundId },
    data: {
      bestSubmissionId: comparison.verdict === "correct" ? job.submissionId : undefined,
      finalVerdict: comparison.verdict === "correct" ? "CORRECT" : "INCORRECT",
      finalMatchTier: comparison.matchTier.toUpperCase() as
        | "EXACT"
        | "NORMALIZED"
        | "RENDERED"
        | "ALTERNATE"
        | "NONE",
      resolvedAt: new Date()
    }
  });

  if (comparison.verdict === "correct") {
    const round = await prisma.gameRound.findUniqueOrThrow({
      where: { id: job.roundId },
      include: { gameSession: true }
    });

    const points = comparison.matchTier === "rendered" ? 75 : comparison.matchTier === "alternate" ? 80 : 0;

    await prisma.gameSession.update({
      where: { id: round.gameSessionId },
      data: {
        totalScore: { increment: points },
        promptsCorrect: { increment: 1 }
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
