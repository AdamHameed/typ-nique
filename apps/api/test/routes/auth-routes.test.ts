import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearAuthSession: vi.fn(),
  ensurePlayerSession: vi.fn(),
  issueAuthSession: vi.fn(),
  promoteGuestHistory: vi.fn(),
  resolveAuthContext: vi.fn(),
  buildRateLimitKey: vi.fn(),
  checkRateLimit: vi.fn(),
  logSecurityEvent: vi.fn(),
  authenticateUser: vi.fn(),
  getUserHistory: vi.fn(),
  registerUser: vi.fn()
}));

vi.mock("../../src/lib/auth.js", () => ({
  clearAuthSession: mocks.clearAuthSession,
  ensurePlayerSession: mocks.ensurePlayerSession,
  issueAuthSession: mocks.issueAuthSession,
  promoteGuestHistory: mocks.promoteGuestHistory,
  resolveAuthContext: mocks.resolveAuthContext
}));

vi.mock("../../src/lib/rate-limit.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/rate-limit.js")>("../../src/lib/rate-limit.js");
  return {
    ...actual,
    buildRateLimitKey: mocks.buildRateLimitKey,
    checkRateLimit: mocks.checkRateLimit
  };
});

vi.mock("../../src/lib/env.js", () => ({
  env: {
    AUTH_RATE_LIMIT_MAX: 10,
    AUTH_RATE_LIMIT_WINDOW_MS: 60000
  }
}));

vi.mock("../../src/lib/security-observability.js", () => ({
  logSecurityEvent: mocks.logSecurityEvent
}));

vi.mock("../../src/services/auth-service.js", () => ({
  authenticateUser: mocks.authenticateUser,
  getUserHistory: mocks.getUserHistory,
  registerUser: mocks.registerUser,
  toAuthSessionView: (user: { id: string; username: string; email: string | null; displayName: string | null } | null) => ({
    authenticated: Boolean(user),
    guest: !user,
    user
  })
}));

import { authRoutes } from "../../src/routes/auth-routes.js";

describe("authRoutes", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    await app.register(authRoutes);

    mocks.resolveAuthContext.mockResolvedValue({
      userId: null,
      playerSessionId: "guest-1",
      authenticated: false,
      guest: true,
      user: null
    });
    mocks.ensurePlayerSession.mockResolvedValue("guest-1");
    mocks.buildRateLimitKey.mockReturnValue("auth:tester");
    mocks.checkRateLimit.mockReturnValue({
      allowed: true,
      remaining: 9,
      resetsAt: Date.now() + 60000
    });
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it("returns 409 when registration hits a duplicate username", async () => {
    mocks.registerUser.mockRejectedValue(new Error("Username is already taken."));

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        username: "tester",
        displayName: "Tester",
        password: "password123"
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "Username is already taken."
    });
  });

  it("returns 401 on invalid login credentials", async () => {
    mocks.authenticateUser.mockRejectedValue(new Error("Invalid username or password."));

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: "tester",
        password: "password123"
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "Invalid username or password."
    });
    expect(mocks.logSecurityEvent).toHaveBeenCalledWith(
      "auth-login-failed",
      expect.objectContaining({
        ip: expect.any(String),
        principalHash: expect.any(String)
      })
    );
  });

  it("returns 429 when the auth rate limit is exceeded", async () => {
    mocks.checkRateLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetsAt: Date.now() + 60000
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: "tester",
        password: "password123"
      }
    });

    expect(response.statusCode).toBe(429);
    expect(response.headers["ratelimit-limit"]).toBe("10");
    expect(response.headers["retry-after"]).toBeDefined();
    expect(response.json()).toEqual({
      error: "Too many authentication attempts. Please wait a moment and try again."
    });
  });
});
