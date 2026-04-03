import type { FastifyInstance } from "fastify";
import { getDailyChallenge } from "../services/challenge-service.js";

export async function challengeRoutes(app: FastifyInstance) {
  app.get("/api/v1/challenges/daily", async () => {
    const challenge = await getDailyChallenge();

    return {
      data: challenge
    };
  });
}
