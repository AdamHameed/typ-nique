import type {
  ChallengeInputMode,
  ChallengePrompt,
  GameSessionResult,
  GameSessionState,
  LeaderboardResponse,
  LeaderboardEntryView,
  PersonalLeaderboardResponse,
  PreviewRenderResponse,
  SubmissionOutcome
} from "@typ-nique/types";

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: init?.cache ?? "no-store"
  });

  if (!response.ok) {
    const fallbackMessage = `Request failed for ${path}`;

    try {
      const payload = (await response.json()) as { error?: string; message?: string };
      throw new Error(payload.message ?? payload.error ?? fallbackMessage);
    } catch {
      throw new Error(fallbackMessage);
    }
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

export async function createPracticeSession() {
  return fetchJson<{ data: GameSessionState }>("/api/v1/game-sessions", {
    method: "POST",
    body: JSON.stringify({ mode: "practice" })
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

export async function previewTypstRender(source: string, inputMode: ChallengeInputMode, signal?: AbortSignal) {
  const response = await fetch(`${baseUrl}/api/v1/render/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ source, inputMode }),
    cache: "no-store",
    signal
  });

  const payload = (await response.json()) as PreviewRenderResponse;

  if (!response.ok && !payload.message) {
    throw new Error("Preview render failed.");
  }

  return payload;
}
