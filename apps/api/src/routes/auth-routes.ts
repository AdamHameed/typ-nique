import type { FastifyInstance, FastifyReply } from "fastify";
import { createHash } from "node:crypto";
import { authHistoryQuerySchema, authLoginSchema, authRegisterSchema } from "@typ-nique/validation";
import { clearAuthSession, ensurePlayerSession, issueAuthSession, promoteGuestHistory, resolveAuthContext } from "../lib/auth.js";
import { buildRateLimitKey, checkRateLimit, applyRateLimitHeaders } from "../lib/rate-limit.js";
import { env } from "../lib/env.js";
import { logSecurityEvent } from "../lib/security-observability.js";
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
    if (!allowAuthRequest(request.ip, reply, body.username)) {
      logSecurityEvent("auth-rate-limit-exceeded", {
        action: "register",
        requestId: request.id,
        ip: request.ip,
        principalHash: hashPrincipal(body.username)
      });
      return reply.code(429).send({ error: "Too many authentication attempts. Please wait a moment and try again." });
    }

    const auth = await resolveAuthContext(request);
    const playerSessionId = await ensurePlayerSession(request, reply, auth);
    let user: Awaited<ReturnType<typeof registerUser>>;

    try {
      user = await registerUser(body);
    } catch (error) {
      if (error instanceof Error && error.message === "Username is already taken.") {
        logSecurityEvent("auth-register-conflict", {
          requestId: request.id,
          ip: request.ip,
          principalHash: hashPrincipal(body.username)
        });
        return reply.code(409).send({ error: error.message });
      }

      throw error;
    }

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
    if (!allowAuthRequest(request.ip, reply, body.identifier)) {
      logSecurityEvent("auth-rate-limit-exceeded", {
        action: "login",
        requestId: request.id,
        ip: request.ip,
        principalHash: hashPrincipal(body.identifier)
      });
      return reply.code(429).send({ error: "Too many authentication attempts. Please wait a moment and try again." });
    }

    const auth = await resolveAuthContext(request);
    const playerSessionId = await ensurePlayerSession(request, reply, auth);
    let user: Awaited<ReturnType<typeof authenticateUser>>;

    try {
      user = await authenticateUser(body);
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid username or password.") {
        logSecurityEvent("auth-login-failed", {
          requestId: request.id,
          ip: request.ip,
          principalHash: hashPrincipal(body.identifier)
        });
        return reply.code(401).send({ error: error.message });
      }

      throw error;
    }

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

function allowAuthRequest(ip: string, reply: FastifyReply, principal?: string) {
  const limiter = checkRateLimit(
    buildRateLimitKey("auth", principal?.trim().toLowerCase() ?? null, ip),
    env.AUTH_RATE_LIMIT_MAX,
    env.AUTH_RATE_LIMIT_WINDOW_MS
  );

  applyRateLimitHeaders(reply, limiter, {
    limit: env.AUTH_RATE_LIMIT_MAX,
    windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS
  });

  return limiter.allowed;
}

function hashPrincipal(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 16);
}
