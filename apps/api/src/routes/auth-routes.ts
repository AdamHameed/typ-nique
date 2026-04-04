import type { FastifyInstance } from "fastify";
import { authHistoryQuerySchema, authLoginSchema, authRegisterSchema } from "@typ-nique/validation";
import { clearAuthSession, ensurePlayerSession, issueAuthSession, promoteGuestHistory, resolveAuthContext } from "../lib/auth.js";
import { authenticateUser, getUserHistory, registerUser, toAuthSessionView } from "../services/auth-service.js";

export async function authRoutes(app: FastifyInstance) {
  app.get("/api/v1/auth/session", async (request, reply) => {
    const auth = await resolveAuthContext(request);
    const playerSessionId = await ensurePlayerSession(request, reply, auth);

    return {
      data: {
        ...toAuthSessionView(auth.user),
        guest: !auth.authenticated,
        playerSessionId
      }
    };
  });

  app.post("/api/v1/auth/register", async (request, reply) => {
    const body = authRegisterSchema.parse(request.body);
    const auth = await resolveAuthContext(request);
    const playerSessionId = await ensurePlayerSession(request, reply, auth);
    const user = await registerUser(body);

    await promoteGuestHistory(playerSessionId, user.id);
    await issueAuthSession(reply, user.id, playerSessionId);

    return reply.code(201).send({
      data: {
        ...toAuthSessionView(user),
        guest: false,
        playerSessionId
      }
    });
  });

  app.post("/api/v1/auth/login", async (request, reply) => {
    const body = authLoginSchema.parse(request.body);
    const auth = await resolveAuthContext(request);
    const playerSessionId = await ensurePlayerSession(request, reply, auth);
    const user = await authenticateUser(body);

    await promoteGuestHistory(playerSessionId, user.id);
    await issueAuthSession(reply, user.id, playerSessionId);

    return {
      data: {
        ...toAuthSessionView(user),
        guest: false,
        playerSessionId
      }
    };
  });

  app.post("/api/v1/auth/logout", async (request, reply) => {
    await clearAuthSession(request, reply);
    return {
      data: {
        authenticated: false,
        guest: true,
        user: null
      }
    };
  });

  app.get("/api/v1/auth/history", async (request, reply) => {
    const auth = await resolveAuthContext(request);

    if (!auth.userId) {
      return reply.code(401).send({ error: "Authentication required." });
    }

    const query = authHistoryQuerySchema.parse(request.query);
    const data = await getUserHistory(auth.userId, query.limit);
    return { data };
  });
}
