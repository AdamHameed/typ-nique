import type { FastifyInstance } from "fastify";
import { compareRenderedOutput } from "@typ-nique/checker";
import type { ChallengePrompt, PreviewRenderResponse } from "@typ-nique/types";
import { previewRenderSchema } from "@typ-nique/validation";
import { buildRateLimitKey, checkRateLimit } from "../lib/rate-limit.js";
import { resolveAuthContext } from "../lib/auth.js";
import { env } from "../lib/env.js";
import { prisma } from "../lib/prisma.js";

export async function renderRoutes(app: FastifyInstance) {
  app.post("/api/v1/render/preview", async (request, reply) => {
    const body = previewRenderSchema.parse(request.body);
    const auth = await resolveAuthContext(request);
    const limiter = checkRateLimit(
      buildRateLimitKey("preview", auth.userId ?? auth.playerSessionId, request.ip),
      env.PREVIEW_RATE_LIMIT_MAX,
      env.PREVIEW_RATE_LIMIT_WINDOW_MS
    );

    if (!limiter.allowed) {
      return reply.code(429).send({
        ok: false,
        errorCode: "RATE_LIMITED",
        message: "Preview rate limit reached. Please slow down."
      } satisfies PreviewRenderResponse);
    }

    try {
      const comparisonPrompt =
        body.sessionId && body.roundId
          ? await getPreviewComparisonPrompt({
              sessionId: body.sessionId,
              roundId: body.roundId,
              actor: auth
            })
          : null;

      const response = await fetch(`${env.WORKER_RENDER_URL}/internal/render/preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(env.WORKER_INTERNAL_TOKEN ? { "x-worker-internal-token": env.WORKER_INTERNAL_TOKEN } : {}),
          "x-request-id": request.id
        },
        body: JSON.stringify(body)
      });

      const payload = (await response.json()) as PreviewRenderResponse;

      if (response.ok && payload.ok && payload.svg && comparisonPrompt) {
        const comparison = compareRenderedOutput({
          submissionSource: body.source,
          canonicalPrompt: comparisonPrompt,
          renderedSvg: payload.svg
        });

        payload.matchesTarget = comparison.verdict === "correct";
        payload.matchTier = comparison.matchTier;
      }

      return reply.code(response.status).send(payload);
    } catch (error) {
      request.log.error(
        {
          error,
          workerRenderUrl: env.WORKER_RENDER_URL
        },
        "Preview render proxy failed."
      );

      return reply.code(503).send({
        ok: false,
        errorCode: "PREVIEW_UNAVAILABLE",
        message: "Preview service is temporarily unavailable."
      } satisfies PreviewRenderResponse & { errorCode: string });
    }
  });
}

async function getPreviewComparisonPrompt(input: {
  sessionId: string;
  roundId: string;
  actor: {
    userId: string | null;
    playerSessionId: string | null;
  };
}): Promise<ChallengePrompt | null> {
  const round = await prisma.gameRound.findUnique({
    where: { id: input.roundId },
    include: {
      gameSession: {
        select: {
          id: true,
          userId: true,
          playerSessionId: true
        }
      },
      challenge: {
        include: {
          category: true,
          canonicalArtifact: true,
          alternateSources: true
        }
      }
    }
  });

  if (!round || round.gameSessionId !== input.sessionId) {
    return null;
  }

  if (
    !(input.actor.userId && round.gameSession.userId === input.actor.userId) &&
    !(input.actor.playerSessionId && round.gameSession.playerSessionId === input.actor.playerSessionId)
  ) {
    return null;
  }

  if (!round.challenge.canonicalArtifact) {
    return null;
  }

  return {
    id: round.challenge.id,
    slug: round.challenge.slug,
    title: round.challenge.title,
    category: round.challenge.category.slug as
      | "basic-math"
      | "fractions"
      | "superscripts-subscripts"
      | "matrices"
      | "alignment-layout"
      | "symbols"
      | "text-formatting"
      | "mixed-expressions",
    difficulty:
      round.challenge.difficulty <= 1
        ? "easy"
        : round.challenge.difficulty === 2
          ? "medium"
          : "hard",
    inputMode: "math",
    canonicalSource: round.challenge.canonicalSource,
    normalizedCanonicalSource: round.challenge.normalizedCanonicalSource,
    renderedSvg: round.challenge.canonicalArtifact.svgInline ?? "",
    acceptedAlternates: round.challenge.alternateSources.map((alternate) => alternate.sourceText)
  };
}
