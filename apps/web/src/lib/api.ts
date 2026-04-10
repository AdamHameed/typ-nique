import type {
  AuthSessionView,
  ChallengeInputMode,
  ChallengePrompt,
  GameSessionResult,
  GameSessionState,
  LeaderboardResponse,
  LeaderboardEntryView,
  MultiplayerGatewayClientEvent,
  MultiplayerRoomPreview,
  MultiplayerRoomReplayData,
  MultiplayerRoomState,
  PersonalLeaderboardResponse,
  PreviewRenderResponse,
  SubmissionOutcome
} from "@typ-nique/types";

const isProduction = process.env.NODE_ENV === "production";
const configuredBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? (isProduction ? undefined : "http://localhost:4000");
const internalBaseUrl =
  process.env.API_INTERNAL_URL ??
  configuredBaseUrl?.replace("://localhost", "://127.0.0.1") ??
  (isProduction ? undefined : "http://127.0.0.1:4000");

function resolveBaseUrl() {
  if (typeof window !== "undefined") {
    return "";
  }

  if (!internalBaseUrl) {
    throw new Error("API_INTERNAL_URL or NEXT_PUBLIC_API_URL must be set for server-side API access in production.");
  }

  return internalBaseUrl;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${resolveBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: init?.cache ?? "no-store",
    credentials: init?.credentials ?? "include"
  });

  if (!response.ok) {
    const fallbackMessage = `Request failed for ${path}`;
    let message = fallbackMessage;

    try {
      const payload = (await response.json()) as { error?: string; message?: string };
      message = payload.message ?? payload.error ?? fallbackMessage;
    } catch {
      // Keep the fallback message.
    }

    throw new ApiError(message, response.status);
  }

  return response.json() as Promise<T>;
}

export async function getDailyChallenge() {
  return fetchJson<{ data: ChallengePrompt | null }>("/api/v1/challenges/daily");
}

export async function getDailyLeaderboard() {
  return fetchJson<{ data: LeaderboardEntryView[] }>("/api/v1/leaderboard/daily");
}

export async function getLeaderboard(scope: "global" | "daily" | "weekly", limit = 25) {
  const params = new URLSearchParams({
    scope,
    limit: String(limit)
  });

  return fetchJson<{ data: LeaderboardResponse }>(`/api/v1/leaderboards?${params.toString()}`);
}

export async function getPersonalLeaderboards(runId: string, limit = 5) {
  const params = new URLSearchParams({
    runId,
    limit: String(limit)
  });

  return fetchJson<{ data: PersonalLeaderboardResponse }>(`/api/v1/leaderboards/personal?${params.toString()}`);
}

export async function getCurrentPersonalLeaderboards(limit = 5) {
  const params = new URLSearchParams({
    limit: String(limit)
  });

  return fetchJson<{ data: PersonalLeaderboardResponse }>(`/api/v1/leaderboards/personal/current?${params.toString()}`);
}

export async function createGameSession(mode: "practice" | "daily" = "practice") {
  return fetchJson<{ data: GameSessionState }>("/api/v1/game-sessions", {
    method: "POST",
    body: JSON.stringify({ mode })
  });
}

export async function getGameSession(sessionId: string) {
  return fetchJson<{ data: GameSessionState }>(`/api/v1/game-sessions/${sessionId}`);
}

export async function submitGameAnswer(payload: { sessionId: string; roundId: string; source: string }) {
  return fetchJson<{ data: SubmissionOutcome }>("/api/v1/submissions", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function skipRound(payload: { sessionId: string; roundId: string }) {
  return fetchJson<{ data: GameSessionState }>(`/api/v1/game-sessions/${payload.sessionId}/skip`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function finishSession(sessionId: string) {
  return fetchJson<{ data: GameSessionResult }>(`/api/v1/game-sessions/${sessionId}/finish`, {
    method: "POST"
  });
}

export async function getSessionResults(sessionId: string) {
  return fetchJson<{ data: GameSessionResult }>(`/api/v1/game-sessions/${sessionId}/results`);
}

export async function previewTypstRender(
  source: string,
  inputMode: ChallengeInputMode,
  signal?: AbortSignal,
  context?: { sessionId?: string; roundId?: string }
) {
  const response = await fetch(`${resolveBaseUrl()}/api/v1/render/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      source,
      inputMode,
      ...(context?.sessionId && context?.roundId
        ? {
            sessionId: context.sessionId,
            roundId: context.roundId
          }
        : {})
    }),
    cache: "no-store",
    credentials: "include",
    signal
  });

  const payload = (await response.json()) as PreviewRenderResponse;

  if (!response.ok && !payload.message) {
    throw new Error("Preview render failed.");
  }

  return payload;
}

export async function getAuthSession() {
  return fetchJson<{ data: AuthSessionView & { playerSessionId?: string } }>("/api/v1/auth/session");
}

export async function registerAccount(payload: {
  username: string;
  password: string;
  displayName?: string;
}) {
  return fetchJson<{ data: AuthSessionView & { playerSessionId?: string } }>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function loginAccount(payload: { identifier: string; password: string }) {
  return fetchJson<{ data: AuthSessionView & { playerSessionId?: string } }>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function logoutAccount() {
  return fetchJson<{ data: AuthSessionView }>("/api/v1/auth/logout", {
    method: "POST"
  });
}

export async function getAuthenticatedHistory(limit = 5) {
  const params = new URLSearchParams({ limit: String(limit) });
  return fetchJson<{ data: PersonalLeaderboardResponse }>(`/api/v1/auth/history?${params.toString()}`);
}

export async function createMultiplayerRoom(payload: {
  durationMinutes: number;
}) {
  return fetchJson<{ data: MultiplayerRoomState }>("/api/v1/multiplayer/rooms", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getMultiplayerRoomPreview(roomCode: string) {
  return fetchJson<{ data: MultiplayerRoomPreview }>(`/api/v1/multiplayer/rooms/code/${encodeURIComponent(roomCode)}`);
}

export async function getMultiplayerRoomSnapshot(roomCode: string) {
  return fetchJson<{ data: MultiplayerRoomState }>(`/api/v1/multiplayer/rooms/code/${encodeURIComponent(roomCode)}/snapshot`);
}

export async function joinMultiplayerRoom(roomCode: string, roomVersion?: number) {
  return fetchJson<{ data: MultiplayerRoomState }>(`/api/v1/multiplayer/rooms/code/${encodeURIComponent(roomCode)}/join`, {
    method: "POST",
    body: JSON.stringify(roomVersion !== undefined ? { roomVersion } : {})
  });
}

export async function leaveMultiplayerRoom(matchId: string, roomVersion?: number) {
  return fetchJson<{ data: MultiplayerRoomState }>(`/api/v1/multiplayer/rooms/${encodeURIComponent(matchId)}/leave`, {
    method: "POST",
    body: JSON.stringify(roomVersion !== undefined ? { roomVersion } : {})
  });
}

export async function setMultiplayerReady(matchId: string, ready: boolean, roomVersion?: number) {
  if (!ready) {
    return fetchJson<{ data: MultiplayerRoomState }>(`/api/v1/multiplayer/rooms/${encodeURIComponent(matchId)}/unready`, {
      method: "POST",
      body: JSON.stringify(roomVersion !== undefined ? { roomVersion } : {})
    });
  }

  return fetchJson<{ data: MultiplayerRoomState }>(`/api/v1/multiplayer/rooms/${encodeURIComponent(matchId)}/ready`, {
    method: "POST",
    body: JSON.stringify({
      ready: true,
      ...(roomVersion !== undefined ? { roomVersion } : {})
    })
  });
}

export async function startMultiplayerCountdown(matchId: string, roomVersion?: number) {
  return fetchJson<{ data: MultiplayerRoomState }>(`/api/v1/multiplayer/rooms/${encodeURIComponent(matchId)}/start`, {
    method: "POST",
    body: JSON.stringify(roomVersion !== undefined ? { roomVersion } : {})
  });
}

export async function resetMultiplayerRoom(matchId: string, roomVersion?: number) {
  return fetchJson<{ data: MultiplayerRoomState }>(`/api/v1/multiplayer/rooms/${encodeURIComponent(matchId)}/reset`, {
    method: "POST",
    body: JSON.stringify(roomVersion !== undefined ? { roomVersion } : {})
  });
}

export async function getMultiplayerRoomResults(matchId: string, includeDiagnostics = false) {
  const params = new URLSearchParams();

  if (includeDiagnostics) {
    params.set("includeDiagnostics", "true");
  }

  return fetchJson<{ data: MultiplayerRoomReplayData }>(
    `/api/v1/multiplayer/rooms/${encodeURIComponent(matchId)}/results${params.size > 0 ? `?${params.toString()}` : ""}`
  );
}

export function getMultiplayerGatewayUrl() {
  const configuredGatewayBaseUrl = process.env.NEXT_PUBLIC_MULTIPLAYER_GATEWAY_URL ?? configuredBaseUrl;

  if (configuredGatewayBaseUrl) {
    return `${configuredGatewayBaseUrl.replace(/^http/, "ws")}/api/v1/multiplayer/ws`;
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin.replace(/^http/, "ws")}/api/v1/multiplayer/ws`;
  }

  throw new Error("NEXT_PUBLIC_MULTIPLAYER_GATEWAY_URL or NEXT_PUBLIC_API_URL must be set in production.");
}

export function encodeGatewayEvent(event: MultiplayerGatewayClientEvent) {
  return JSON.stringify(event);
}
