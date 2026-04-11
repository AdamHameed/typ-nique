import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { ZodError } from "zod";
import { authRoutes } from "./routes/auth-routes.js";
import { challengeRoutes } from "./routes/challenge-routes.js";
import { isAllowedBrowserOrigin } from "./lib/browser-origin.js";
import { env } from "./lib/env.js";
import { logSecurityEvent } from "./lib/security-observability.js";
import { gameSessionRoutes } from "./routes/game-session-routes.js";
import { leaderboardRoutes } from "./routes/leaderboard-routes.js";
import { multiplayerRoutes } from "./routes/multiplayer-routes.js";
import { renderRoutes } from "./routes/render-routes.js";
import { submissionRoutes } from "./routes/submission-routes.js";

export function buildApp() {
  const app = Fastify({
    bodyLimit: env.API_BODY_LIMIT_BYTES,
    requestTimeout: env.API_REQUEST_TIMEOUT_MS,
    requestIdHeader: "x-request-id",
    trustProxy: env.TRUST_PROXY,
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      redact: [
        "req.headers.cookie",
        "req.headers.authorization",
        "req.headers[\"x-worker-internal-token\"]",
        "req.headers[\"x-render-admin-token\"]",
        "res.headers[\"set-cookie\"]"
      ],
      transport:
        env.NODE_ENV === "development"
          ? {
              target: "pino-pretty",
              options: { colorize: true }
            }
          : undefined
    }
  });

  app.register(helmet);
  app.register(cors, {
    credentials: true,
    origin(origin, callback) {
      callback(null, isAllowedBrowserOrigin(origin, env.ALLOWED_BROWSER_ORIGINS));
    }
  });

  app.get("/health", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    return { ok: true };
  });
  app.register(authRoutes);
  app.register(challengeRoutes);
  app.register(gameSessionRoutes);
  app.register(submissionRoutes);
  app.register(renderRoutes);
  app.register(leaderboardRoutes);
  app.register(multiplayerRoutes);

  app.setNotFoundHandler((request, reply) => {
    return reply.code(404).send({
      error: "Not found.",
      requestId: request.id
    });
  });

  app.setErrorHandler((error, request, reply) => {
    if (reply.sent) {
      return;
    }

    const fastifyError = error as { code?: string; statusCode?: number };

    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "Invalid request.",
        requestId: request.id,
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    if (fastifyError.code === "FST_ERR_CTP_BODY_TOO_LARGE" || fastifyError.statusCode === 413) {
      logSecurityEvent("request-body-limit-exceeded", {
        requestId: request.id,
        path: request.url,
        method: request.method,
        ip: request.ip,
        bodyLimitBytes: env.API_BODY_LIMIT_BYTES
      });

      return reply.code(413).send({
        error: "Request payload too large.",
        requestId: request.id
      });
    }

    request.log.error(
      {
        err: error,
        requestId: request.id
      },
      "Unhandled API error"
    );

    return reply.code(500).send({
      error: "Internal server error.",
      requestId: request.id
    });
  });

  return app;
}
