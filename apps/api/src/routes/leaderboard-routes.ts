import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export async function leaderboardRoutes(app: FastifyInstance) {
  app.get("/api/v1/leaderboard/daily", async () => {
    const leaderboard = await prisma.leaderboard.findUnique({
      where: {
        scope_scopeKey: {
          scope: "DAILY",
          scopeKey: "2026-04-03"
        }
      },
      include: {
        entries: {
          orderBy: [{ score: "desc" }, { recordedAt: "asc" }],
          take: 25
        }
      }
    });

    return {
      data:
        leaderboard?.entries.map((entry) => ({
          userName: entry.displayName,
          score: entry.score,
          accuracy: Number(entry.accuracy),
          createdAt: entry.recordedAt.toISOString().slice(0, 10)
        })) ?? []
    };
  });
}
