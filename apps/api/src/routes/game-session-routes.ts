import type { FastifyInstance } from "fastify";
import { createGameSessionSchema, sessionParamsSchema, skipRoundSchema } from "@typ-nique/validation";
import { ensurePlayerSession, resolveAuthContext } from "../lib/auth.js";
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
    const auth = await resolveAuthContext(request);
    const playerSessionId = await ensurePlayerSession(request, reply, auth);
    const session = await createGameSession(body.mode, {
      userId: auth.userId,
      playerSessionId
    });

    return reply.code(201).send({ data: session });
  });

  app.get("/api/v1/game-sessions/:sessionId", async (request, reply) => {
    const params = sessionParamsSchema.parse(request.params);
    const auth = await resolveAuthContext(request);
    let session;

    try {
      session = await getGameSessionState(params.sessionId, auth);
    } catch (error) {
      if (error instanceof Error && error.message === "Session not accessible.") {
        return reply.code(403).send({ error: error.message });
      }

      throw error;
    }

    if (!session) {
      return reply.code(404).send({ error: "Session not found." });
    }

    return { data: session };
  });

  app.post("/api/v1/game-sessions/:sessionId/skip", async (request, reply) => {
    const params = sessionParamsSchema.parse(request.params);
    const body = skipRoundSchema.parse(request.body);
    const auth = await resolveAuthContext(request);
    try {
      const session = await skipCurrentRound(params.sessionId, body.roundId, auth);
      return { data: session };
    } catch (error) {
      if (error instanceof Error && error.message === "Session not accessible.") {
        return reply.code(403).send({ error: error.message });
      }

      if (error instanceof Error && error.message === "Round not found for session.") {
        return reply.code(404).send({ error: error.message });
      }

      throw error;
    }
  });

  app.post("/api/v1/game-sessions/:sessionId/finish", async (request, reply) => {
    const params = sessionParamsSchema.parse(request.params);
    const auth = await resolveAuthContext(request);
    try {
      const result = await finishGameSession(params.sessionId, auth);
      return { data: result };
    } catch (error) {
      if (error instanceof Error && error.message === "Session not accessible.") {
        return reply.code(403).send({ error: error.message });
      }

      throw error;
    }
  });

  app.get("/api/v1/game-sessions/:sessionId/results", async (request, reply) => {
    const params = sessionParamsSchema.parse(request.params);
    const auth = await resolveAuthContext(request);
    try {
      const result = await getGameSessionResults(params.sessionId, auth);
      return { data: result };
    } catch (error) {
      if (error instanceof Error && error.message === "Session not accessible.") {
        return reply.code(403).send({ error: error.message });
      }

      throw error;
    }
  });
}
