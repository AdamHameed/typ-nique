import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ensurePlayerSession, resolveAuthContext } from "../lib/auth.js";
import { env } from "../lib/env.js";
import { applyRateLimitHeaders, buildRateLimitKey, checkRateLimit } from "../lib/rate-limit.js";
import { logSecurityEvent } from "../lib/security-observability.js";
import { describeLeaderboardStrategy, getCurrentPersonalLeaderboards, getLeaderboard, getPersonalLeaderboards } from "../services/leaderboard-service.js";

const leaderboardQuerySchema = z.object({
  scope: z.enum(["global", "daily", "weekly"]).default("daily"),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

const personalQuerySchema = z.object({
  runId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(20).default(5)
});

const currentPersonalQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5)
});

export async function leaderboardRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/v1/leaderboards") && !request.url.startsWith("/api/v1/leaderboard")) {
      return;
    }

    const limiter = checkRateLimit(
      buildRateLimitKey("leaderboard", null, request.ip),
      env.LEADERBOARD_RATE_LIMIT_MAX,
      env.LEADERBOARD_RATE_LIMIT_WINDOW_MS
    );
    applyRateLimitHeaders(reply, limiter, {
      limit: env.LEADERBOARD_RATE_LIMIT_MAX,
      windowMs: env.LEADERBOARD_RATE_LIMIT_WINDOW_MS
    });

    if (!limiter.allowed) {
      logSecurityEvent("leaderboard-rate-limit-exceeded", {
        requestId: request.id,
        ip: request.ip,
        path: request.url
      }, "info");

      return reply.code(429).send({
        error: "Too many leaderboard requests. Please slow down."
      });
    }
  });

  app.get("/api/v1/leaderboards", async (request) => {
    const query = leaderboardQuerySchema.parse(request.query);
    const data = await getLeaderboard(query.scope, query.limit);

    return { data };
  });

  app.get("/api/v1/leaderboards/personal", async (request, reply) => {
    const query = personalQuerySchema.parse(request.query);
    const data = await getPersonalLeaderboards(query.runId, query.limit);

    if (!data) {
      return reply.code(404).send({ error: "Run not found." });
    }

    return { data };
  });

  app.get("/api/v1/leaderboards/personal/current", async (request, reply) => {
    const query = currentPersonalQuerySchema.parse(request.query);
    const auth = await resolveAuthContext(request);
    const playerSessionId = await ensurePlayerSession(request, reply, auth);
    const data = await getCurrentPersonalLeaderboards({
      userId: auth.userId,
      playerSessionId,
      limit: query.limit
    });

    return { data };
  });

  app.get("/api/v1/leaderboards/meta", async () => {
    return {
      data: describeLeaderboardStrategy()
    };
  });

  app.get("/api/v1/leaderboard/daily", async () => {
    const data = await getLeaderboard("daily", 25);
    return { data: data.entries };
  });
}
