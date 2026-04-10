import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { authRoutes } from "./routes/auth-routes.js";
import { challengeRoutes } from "./routes/challenge-routes.js";
import { isAllowedBrowserOrigin } from "./lib/browser-origin.js";
import { env } from "./lib/env.js";
import { gameSessionRoutes } from "./routes/game-session-routes.js";
import { leaderboardRoutes } from "./routes/leaderboard-routes.js";
import { multiplayerRoutes } from "./routes/multiplayer-routes.js";
import { renderRoutes } from "./routes/render-routes.js";
import { submissionRoutes } from "./routes/submission-routes.js";

export function buildApp() {
  const app = Fastify({
    bodyLimit: 16 * 1024,
    trustProxy: env.TRUST_PROXY,
    logger: {
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

  app.get("/health", async () => ({ ok: true }));
  app.register(authRoutes);
  app.register(challengeRoutes);
  app.register(gameSessionRoutes);
  app.register(submissionRoutes);
  app.register(renderRoutes);
  app.register(leaderboardRoutes);
  app.register(multiplayerRoutes);

  return app;
}
