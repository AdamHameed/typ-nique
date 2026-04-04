import type { FastifyInstance } from "fastify";
import type { PreviewRenderResponse } from "@typ-nique/types";
import { previewRenderSchema } from "@typ-nique/validation";
import { buildRateLimitKey, checkRateLimit } from "../lib/rate-limit.js";
import { resolveAuthContext } from "../lib/auth.js";
import { env } from "../lib/env.js";

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
