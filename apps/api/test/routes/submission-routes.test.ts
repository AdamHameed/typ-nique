import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveAuthContext: vi.fn(),
  buildRateLimitKey: vi.fn(),
  checkRateLimit: vi.fn(),
  submitAttempt: vi.fn()
}));

vi.mock("../../src/lib/auth.js", () => ({
  resolveAuthContext: mocks.resolveAuthContext
}));

vi.mock("../../src/lib/rate-limit.js", () => ({
  buildRateLimitKey: mocks.buildRateLimitKey,
  checkRateLimit: mocks.checkRateLimit
}));

vi.mock("../../src/lib/env.js", () => ({
  env: {
    SUBMISSION_RATE_LIMIT_MAX: 10,
    SUBMISSION_RATE_LIMIT_WINDOW_MS: 60000
  }
}));

vi.mock("../../src/services/submission-service.js", () => ({
  submitAttempt: mocks.submitAttempt
}));

import { submissionRoutes } from "../../src/routes/submission-routes.js";

describe("submissionRoutes", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    await app.register(submissionRoutes);

    mocks.resolveAuthContext.mockResolvedValue({
      userId: null,
      playerSessionId: "guest-1"
    });
    mocks.buildRateLimitKey.mockReturnValue("submission:guest-1");
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

  it("submits an attempt and returns the service payload", async () => {
    mocks.submitAttempt.mockResolvedValue({
      verdict: "correct",
      matchTier: "normalized",
      normalizedSource: "x^2+y^2=z^2",
      feedback: "Accepted. Your answer matches the target output."
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/submissions",
      payload: {
        sessionId: "8d6610d7-73af-4ce8-9448-6f6a486f0011",
        roundId: "8d6610d7-73af-4ce8-9448-6f6a486f0022",
        source: "x^2 + y^2 = z^2"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.submitAttempt).toHaveBeenCalledWith({
      sessionId: "8d6610d7-73af-4ce8-9448-6f6a486f0011",
      roundId: "8d6610d7-73af-4ce8-9448-6f6a486f0022",
      source: "x^2 + y^2 = z^2",
      actor: {
        userId: null,
        playerSessionId: "guest-1"
      }
    });
  });

  it("returns 429 when the submission rate limit is exceeded", async () => {
    mocks.checkRateLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetsAt: Date.now() + 60000
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/submissions",
      payload: {
        sessionId: "8d6610d7-73af-4ce8-9448-6f6a486f0011",
        roundId: "8d6610d7-73af-4ce8-9448-6f6a486f0022",
        source: "x^2 + y^2 = z^2"
      }
    });

    expect(response.statusCode).toBe(429);
    expect(response.json()).toEqual({
      error: "Submission rate limit reached. Please wait a moment and try again."
    });
  });

  it("returns a multiplayer-safe 429 when the race limiter rejects a submission", async () => {
    mocks.submitAttempt.mockRejectedValue(new Error("Multiplayer submission rate limit reached."));

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/submissions",
      payload: {
        sessionId: "8d6610d7-73af-4ce8-9448-6f6a486f0011",
        roundId: "8d6610d7-73af-4ce8-9448-6f6a486f0022",
        source: "x^2 + y^2 = z^2"
      }
    });

    expect(response.statusCode).toBe(429);
    expect(response.json()).toEqual({
      error: "Race submission rate limit reached. Please slow down and try again."
    });
  });
});
