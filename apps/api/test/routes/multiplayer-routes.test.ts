import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMultiplayerReplayFixture, createMultiplayerRoomStateFixture } from "../helpers/multiplayer-fixtures";

vi.hoisted(() => {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/typ_nique_test";
  process.env.REDIS_URL ??= "redis://localhost:6379";
});

const mocks = vi.hoisted(() => ({
  resolveAuthContext: vi.fn(),
  ensurePlayerSession: vi.fn(),
  createMultiplayerRoom: vi.fn(),
  getMultiplayerRoom: vi.fn(),
  getMultiplayerRoomByCode: vi.fn(),
  getMultiplayerRoomPreviewByCode: vi.fn(),
  getMultiplayerRoomReplayData: vi.fn(),
  joinMultiplayerRoom: vi.fn(),
  joinMultiplayerRoomByCode: vi.fn(),
  leaveMultiplayerRoom: vi.fn(),
  resetMultiplayerRoomToLobby: vi.fn(),
  setMultiplayerReadiness: vi.fn(),
  startMultiplayerCountdown: vi.fn()
}));

vi.mock("../../src/lib/auth.js", () => ({
  resolveAuthContext: mocks.resolveAuthContext,
  ensurePlayerSession: mocks.ensurePlayerSession
}));

vi.mock("../../src/services/multiplayer-service.js", () => ({
  createMultiplayerRoom: mocks.createMultiplayerRoom,
  getMultiplayerRoom: mocks.getMultiplayerRoom,
  getMultiplayerRoomByCode: mocks.getMultiplayerRoomByCode,
  getMultiplayerRoomPreviewByCode: mocks.getMultiplayerRoomPreviewByCode,
  getMultiplayerRoomReplayData: mocks.getMultiplayerRoomReplayData,
  joinMultiplayerRoom: mocks.joinMultiplayerRoom,
  joinMultiplayerRoomByCode: mocks.joinMultiplayerRoomByCode,
  leaveMultiplayerRoom: mocks.leaveMultiplayerRoom,
  resetMultiplayerRoomToLobby: mocks.resetMultiplayerRoomToLobby,
  setMultiplayerReadiness: mocks.setMultiplayerReadiness,
  startMultiplayerCountdown: mocks.startMultiplayerCountdown
}));

import { multiplayerRoutes } from "../../src/routes/multiplayer-routes.js";

describe("multiplayerRoutes", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    await app.register(multiplayerRoutes);

    mocks.resolveAuthContext.mockResolvedValue({
      userId: null,
      playerSessionId: "guest-1",
      user: null
    });
    mocks.ensurePlayerSession.mockResolvedValue("guest-1");
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it("creates a multiplayer room and returns 201", async () => {
    mocks.createMultiplayerRoom.mockResolvedValue(createMultiplayerRoomStateFixture());

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/multiplayer/rooms",
      payload: {
        durationMinutes: 2
      }
    });

    expect(response.statusCode).toBe(201);
    expect(mocks.createMultiplayerRoom).toHaveBeenCalledWith(
      {
        durationMinutes: 2
      },
      expect.objectContaining({
        playerSessionId: "guest-1"
      })
    );
  });

  it("maps room access failures to 403", async () => {
    mocks.getMultiplayerRoom.mockRejectedValue(new Error("Room not accessible."));

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/multiplayer/rooms/8d6610d7-73af-4ce8-9448-6f6a486f0011"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "Room not accessible." });
  });

  it("joins a room by code", async () => {
    mocks.joinMultiplayerRoomByCode.mockResolvedValue(createMultiplayerRoomStateFixture());

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/multiplayer/rooms/code/ABC123/join",
      payload: { roomVersion: 2 }
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.joinMultiplayerRoomByCode).toHaveBeenCalledWith(
      "ABC123",
      expect.objectContaining({ playerSessionId: "guest-1" }),
      { expectedRoomVersion: 2 }
    );
  });

  it("returns replay payload for results hydration", async () => {
    mocks.getMultiplayerRoomReplayData.mockResolvedValue(createMultiplayerReplayFixture());

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/multiplayer/rooms/8d6610d7-73af-4ce8-9448-6f6a486f0011/results"
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.getMultiplayerRoomReplayData).toHaveBeenCalled();
  });

  it("marks a player ready with room version protection", async () => {
    mocks.setMultiplayerReadiness.mockResolvedValue(
      createMultiplayerRoomStateFixture({
        canStart: true
      })
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/multiplayer/rooms/8d6610d7-73af-4ce8-9448-6f6a486f0011/ready",
      payload: { ready: true, roomVersion: 4 }
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.setMultiplayerReadiness).toHaveBeenCalledWith(
      "8d6610d7-73af-4ce8-9448-6f6a486f0011",
      expect.objectContaining({ playerSessionId: "guest-1" }),
      true,
      { expectedRoomVersion: 4 }
    );
  });

  it("starts countdown with room version protection", async () => {
    mocks.startMultiplayerCountdown.mockResolvedValue(
      createMultiplayerRoomStateFixture({
        status: "countdown",
        isLocked: true,
        countdownEndsAt: "2026-04-10T12:00:05.000Z",
        countdownRemainingMs: 5000
      })
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/multiplayer/rooms/8d6610d7-73af-4ce8-9448-6f6a486f0011/start",
      payload: { roomVersion: 5 }
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.startMultiplayerCountdown).toHaveBeenCalledWith(
      "8d6610d7-73af-4ce8-9448-6f6a486f0011",
      expect.objectContaining({ playerSessionId: "guest-1" }),
      { expectedRoomVersion: 5 }
    );
  });

  it("leaves a room with room version protection", async () => {
    mocks.leaveMultiplayerRoom.mockResolvedValue(
      createMultiplayerRoomStateFixture({
        players: [],
        standings: [],
        finalPlacements: []
      })
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/multiplayer/rooms/8d6610d7-73af-4ce8-9448-6f6a486f0011/leave",
      payload: { roomVersion: 6 }
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.leaveMultiplayerRoom).toHaveBeenCalledWith(
      "8d6610d7-73af-4ce8-9448-6f6a486f0011",
      expect.objectContaining({ playerSessionId: "guest-1" }),
      { expectedRoomVersion: 6 }
    );
  });

  it("passes diagnostics flag only for authenticated users", async () => {
    mocks.resolveAuthContext.mockResolvedValueOnce({
      userId: "user-1",
      playerSessionId: "guest-1",
      authenticated: true,
      user: {
        id: "user-1",
        username: "tester",
        email: null,
        displayName: "Tester"
      }
    });
    mocks.getMultiplayerRoomReplayData.mockResolvedValue(createMultiplayerReplayFixture());

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/multiplayer/rooms/8d6610d7-73af-4ce8-9448-6f6a486f0011/results?includeDiagnostics=true"
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.getMultiplayerRoomReplayData).toHaveBeenCalledWith(
      "8d6610d7-73af-4ce8-9448-6f6a486f0011",
      expect.objectContaining({ userId: "user-1" }),
      { includeDiagnostics: true }
    );
  });

  it("resets a completed room back to lobby with room version protection", async () => {
    mocks.resetMultiplayerRoomToLobby.mockResolvedValue(
      createMultiplayerRoomStateFixture({
        status: "pending",
        startedAt: null,
        countdownEndsAt: null,
        endedAt: null,
        finalPlacements: []
      })
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/multiplayer/rooms/8d6610d7-73af-4ce8-9448-6f6a486f0011/reset",
      payload: { roomVersion: 7 }
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.resetMultiplayerRoomToLobby).toHaveBeenCalledWith(
      "8d6610d7-73af-4ce8-9448-6f6a486f0011",
      expect.objectContaining({ playerSessionId: "guest-1" }),
      { expectedRoomVersion: 7 }
    );
  });
});
