import type { FastifyInstance } from "fastify";
import { submitAttemptSchema } from "@typ-nique/validation";
import { resolveAuthContext } from "../lib/auth.js";
import { buildRateLimitKey, checkRateLimit } from "../lib/rate-limit.js";
import { env } from "../lib/env.js";
import { submitAttempt } from "../services/submission-service.js";

export async function submissionRoutes(app: FastifyInstance) {
  app.post("/api/v1/submissions", async (request, reply) => {
    const body = submitAttemptSchema.parse(request.body);
    const auth = await resolveAuthContext(request);
    const limiter = checkRateLimit(
      buildRateLimitKey("submission", auth.userId ?? auth.playerSessionId, request.ip),
      env.SUBMISSION_RATE_LIMIT_MAX,
      env.SUBMISSION_RATE_LIMIT_WINDOW_MS
    );

    if (!limiter.allowed) {
      return reply.code(429).send({
        error: "Submission rate limit reached. Please wait a moment and try again."
      });
    }

    try {
      const result = await submitAttempt({
        ...body,
        actor: auth
      });

      return reply.code(200).send({ data: result });
    } catch (error) {
      if (error instanceof Error && error.message === "Multiplayer submission rate limit reached.") {
        return reply.code(429).send({
          error: "Race submission rate limit reached. Please slow down and try again."
        });
      }

      if (error instanceof Error && error.message === "Round not accessible.") {
        return reply.code(403).send({ error: error.message });
      }

      if (error instanceof Error && error.message === "Round not found for session.") {
        return reply.code(404).send({ error: error.message });
      }

      throw error;
    }
  });
}
