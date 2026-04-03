import type {
  ChallengePrompt,
  GameSessionResult,
  GameSessionState,
  LeaderboardEntryView,
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
    throw new Error(`Request failed for ${path}`);
  }

  return response.json() as Promise<T>;
}

export async function getDailyChallenge() {
  return fetchJson<{ data: ChallengePrompt | null }>("/api/v1/challenges/daily");
}

export async function getDailyLeaderboard() {
  return fetchJson<{ data: LeaderboardEntryView[] }>("/api/v1/leaderboard/daily");
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
