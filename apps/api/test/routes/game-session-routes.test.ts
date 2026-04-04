import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveAuthContext: vi.fn(),
  ensurePlayerSession: vi.fn(),
  createGameSession: vi.fn(),
  getGameSessionState: vi.fn(),
  skipCurrentRound: vi.fn(),
  finishGameSession: vi.fn(),
  getGameSessionResults: vi.fn()
}));

vi.mock("../../src/lib/auth.js", () => ({
  resolveAuthContext: mocks.resolveAuthContext,
  ensurePlayerSession: mocks.ensurePlayerSession
}));

vi.mock("../../src/services/game-service.js", () => ({
  createGameSession: mocks.createGameSession,
  getGameSessionState: mocks.getGameSessionState,
  skipCurrentRound: mocks.skipCurrentRound,
  finishGameSession: mocks.finishGameSession,
  getGameSessionResults: mocks.getGameSessionResults
}));

import { gameSessionRoutes } from "../../src/routes/game-session-routes.js";

describe("gameSessionRoutes", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    await app.register(gameSessionRoutes);

    mocks.resolveAuthContext.mockResolvedValue({
      userId: null,
      playerSessionId: "guest-1"
    });
    mocks.ensurePlayerSession.mockResolvedValue("guest-1");
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it("creates a game session and returns 201", async () => {
    mocks.createGameSession.mockResolvedValue({
      id: "session-1",
      status: "active",
      mode: "practice",
      startedAt: "2026-04-04T12:00:00.000Z",
      endsAt: "2026-04-04T12:03:00.000Z",
      durationMs: 180000,
      timeRemainingMs: 180000,
      score: 0,
      solvedCount: 0,
      attemptedCount: 0,
      accuracy: 0,
      streak: 0,
      currentRound: null,
      lastResult: null
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/game-sessions",
      payload: { mode: "practice" }
    });

    expect(response.statusCode).toBe(201);
    expect(mocks.createGameSession).toHaveBeenCalledWith("practice", {
      userId: null,
      playerSessionId: "guest-1"
    });
  });

  it("returns 403 when a session is not accessible", async () => {
    mocks.getGameSessionState.mockRejectedValue(new Error("Session not accessible."));

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/game-sessions/8d6610d7-73af-4ce8-9448-6f6a486f0011"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "Session not accessible." });
  });
});
