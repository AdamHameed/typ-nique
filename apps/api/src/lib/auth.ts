import type { FastifyReply, FastifyRequest } from "fastify";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma.js";
import { env } from "./env.js";

export interface RequestAuthContext {
  userId: string | null;
  playerSessionId: string | null;
  authenticated: boolean;
  guest: boolean;
  user:
    | {
        id: string;
        username: string;
        email: string | null;
        displayName: string | null;
      }
    | null;
}

const AUTH_COOKIE_NAME = env.AUTH_COOKIE_NAME;
const GUEST_COOKIE_NAME = env.GUEST_COOKIE_NAME;
const SESSION_TTL_MS = env.AUTH_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

export async function resolveAuthContext(request: FastifyRequest): Promise<RequestAuthContext> {
  const cookies = parseCookies(request.headers.cookie);
  const authToken = cookies[AUTH_COOKIE_NAME];
  const guestToken = cookies[GUEST_COOKIE_NAME];

  if (authToken) {
    const authSession = await prisma.authSession.findUnique({
      where: {
        sessionTokenHash: sha256(authToken)
      },
      include: {
        user: true,
        playerSession: true
      }
    });

    if (authSession && authSession.expiresAt.getTime() > Date.now()) {
      await prisma.authSession.update({
        where: { id: authSession.id },
        data: { lastSeenAt: new Date() }
      });

      if (authSession.playerSessionId) {
        await prisma.playerSession.update({
          where: { id: authSession.playerSessionId },
          data: {
            lastSeenAt: new Date()
          }
        });
      }

      return {
        userId: authSession.userId,
        playerSessionId: authSession.playerSessionId ?? null,
        authenticated: true,
        guest: false,
        user: {
          id: authSession.user.id,
          username: authSession.user.username,
          email: authSession.user.email,
          displayName: authSession.user.displayName
        }
      };
    }
  }

  if (guestToken) {
    const playerSession = await prisma.playerSession.findFirst({
      where: {
        guestTokenHash: sha256(guestToken)
      }
    });

    if (playerSession) {
      await prisma.playerSession.update({
        where: { id: playerSession.id },
        data: { lastSeenAt: new Date() }
      });

      return {
        userId: null,
        playerSessionId: playerSession.id,
        authenticated: false,
        guest: true,
        user: null
      };
    }
  }

  return {
    userId: null,
    playerSessionId: null,
    authenticated: false,
    guest: true,
    user: null
  };
}

export async function ensurePlayerSession(request: FastifyRequest, reply: FastifyReply, context?: RequestAuthContext) {
  const resolved = context ?? (await resolveAuthContext(request));

  if (resolved.playerSessionId) {
    return resolved.playerSessionId;
  }

  const guestToken = createSessionToken();
  const playerSession = await prisma.playerSession.create({
    data: {
      userId: resolved.userId,
      guestTokenHash: sha256(guestToken),
      userAgent: request.headers["user-agent"] ?? null,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS)
    }
  });

  setCookie(reply, GUEST_COOKIE_NAME, guestToken, SESSION_TTL_MS);

  return playerSession.id;
}

export async function issueAuthSession(reply: FastifyReply, userId: string, playerSessionId: string | null) {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.authSession.create({
    data: {
      userId,
      playerSessionId,
      sessionTokenHash: sha256(token),
      expiresAt
    }
  });

  setCookie(reply, AUTH_COOKIE_NAME, token, SESSION_TTL_MS);
}

export async function clearAuthSession(request: FastifyRequest, reply: FastifyReply) {
  const cookies = parseCookies(request.headers.cookie);
  const authToken = cookies[AUTH_COOKIE_NAME];

  if (authToken) {
    await prisma.authSession.deleteMany({
      where: {
        sessionTokenHash: sha256(authToken)
      }
    });
  }

  clearCookie(reply, AUTH_COOKIE_NAME);
}

export async function promoteGuestHistory(playerSessionId: string | null, userId: string) {
  if (!playerSessionId) {
    return;
  }

  await prisma.playerSession.update({
    where: { id: playerSessionId },
    data: { userId }
  });

  await prisma.gameSession.updateMany({
    where: {
      playerSessionId,
      userId: null
    },
    data: { userId }
  });

  await prisma.scoreRecord.updateMany({
    where: {
      gameSession: {
        playerSessionId,
        userId
      },
      userId: null
    },
    data: { userId }
  });
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, passwordHash: string | null) {
  if (!passwordHash) {
    return false;
  }

  const [algorithm, salt, storedHash] = passwordHash.split(":");

  if (algorithm !== "scrypt" || !salt || !storedHash) {
    return false;
  }

  const computedHash = scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(storedHash, "hex");

  if (computedHash.length !== storedBuffer.length) {
    return false;
  }

  return timingSafeEqual(computedHash, storedBuffer);
}

function parseCookies(header?: string) {
  const cookies: Record<string, string> = {};

  if (!header) {
    return cookies;
  }

  for (const fragment of header.split(";")) {
    const [rawKey, ...rawValue] = fragment.trim().split("=");

    if (!rawKey) {
      continue;
    }

    cookies[rawKey] = decodeURIComponent(rawValue.join("="));
  }

  return cookies;
}

function setCookie(reply: FastifyReply, name: string, value: string, maxAgeMs: number) {
  appendCookie(reply, serializeCookie(name, value, maxAgeMs));
}

function clearCookie(reply: FastifyReply, name: string) {
  appendCookie(reply, serializeCookie(name, "", 0));
}

function appendCookie(reply: FastifyReply, value: string) {
  const existing = reply.getHeader("Set-Cookie");

  if (!existing) {
    reply.header("Set-Cookie", value);
    return;
  }

  const next = Array.isArray(existing) ? [...existing, value] : [String(existing), value];
  reply.header("Set-Cookie", next);
}

function serializeCookie(name: string, value: string, maxAgeMs: number) {
  const segments = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Math.floor(maxAgeMs / 1000))}`
  ];

  if (env.AUTH_COOKIE_SECURE) {
    segments.push("Secure");
  }

  if (env.AUTH_COOKIE_DOMAIN) {
    segments.push(`Domain=${env.AUTH_COOKIE_DOMAIN}`);
  }

  return segments.join("; ");
}

function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
