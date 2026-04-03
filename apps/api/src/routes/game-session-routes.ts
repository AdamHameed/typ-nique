import type { FastifyInstance } from "fastify";
import { createGameSessionSchema, sessionParamsSchema, skipRoundSchema } from "@typ-nique/validation";
import {
  createGameSession,
  finishGameSession,
  getGameSessionResults,
  getGameSessionState,
  skipCurrentRound
} from "../services/game-service.js";

export async function gameSessionRoutes(app: FastifyInstance) {
  app.post("/api/v1/game-sessions", async (request, reply) => {
    const body = createGameSessionSchema.parse(request.body);
    const session = await createGameSession(body.mode);

    return reply.code(201).send({ data: session });
  });

  app.get("/api/v1/game-sessions/:sessionId", async (request, reply) => {
    const params = sessionParamsSchema.parse(request.params);
    const session = await getGameSessionState(params.sessionId);

    if (!session) {
      return reply.code(404).send({ error: "Session not found." });
    }

    return { data: session };
  });

  app.post("/api/v1/game-sessions/:sessionId/skip", async (request) => {
    const params = sessionParamsSchema.parse(request.params);
    const body = skipRoundSchema.parse(request.body);
    const session = await skipCurrentRound(params.sessionId, body.roundId);

    return { data: session };
  });

  app.post("/api/v1/game-sessions/:sessionId/finish", async (request) => {
    const params = sessionParamsSchema.parse(request.params);
    const result = await finishGameSession(params.sessionId);

    return { data: result };
  });

  app.get("/api/v1/game-sessions/:sessionId/results", async (request) => {
    const params = sessionParamsSchema.parse(request.params);
    const result = await getGameSessionResults(params.sessionId);

    return { data: result };
  });
}
