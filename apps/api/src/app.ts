import Fastify from "fastify";
import cors from "@fastify/cors";
import { challengeRoutes } from "./routes/challenge-routes.js";
import { gameSessionRoutes } from "./routes/game-session-routes.js";
import { leaderboardRoutes } from "./routes/leaderboard-routes.js";
import { renderRoutes } from "./routes/render-routes.js";
import { submissionRoutes } from "./routes/submission-routes.js";

export function buildApp() {
  const app = Fastify({
    logger: {
      transport:
        process.env.NODE_ENV === "development"
          ? {
              target: "pino-pretty",
              options: { colorize: true }
            }
          : undefined
    }
  });

  app.register(cors, { origin: true });

  app.get("/health", async () => ({ ok: true }));
  app.register(challengeRoutes);
  app.register(gameSessionRoutes);
  app.register(submissionRoutes);
  app.register(renderRoutes);
  app.register(leaderboardRoutes);

  return app;
}
