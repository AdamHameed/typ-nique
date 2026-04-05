import type { Prisma } from "@prisma/client";
import type {
  LeaderboardEntryView,
  LeaderboardResponse,
  LeaderboardScope,
  PersonalLeaderboardResponse,
  PersonalRunView
} from "@typ-nique/types";
import { prisma } from "../lib/prisma.js";
import { ensureDailyChallengeForDate } from "./challenge-service.js";

const CACHE_TTL_MS = 15_000;

type CacheValue<T> = {
  expiresAt: number;
  value: T;
};

const cache = new Map<string, CacheValue<unknown>>();

export async function getLeaderboard(scope: LeaderboardScope, limit = 25): Promise<LeaderboardResponse> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const cacheKey = `board:${scope}:${safeLimit}`;
  const cached = getCached<LeaderboardResponse>(cacheKey);

  if (cached) {
    return cached;
  }

  const { where, windowStart, windowEnd, label } = await buildScopeWindow(scope);
  const sessions =
    scope === "daily"
      ? await getDailyBestSessions(safeLimit, where)
      : await prisma.gameSession.findMany({
          where,
          orderBy: [{ totalScore: "desc" }, { endedAt: "asc" }, { startedAt: "asc" }],
          take: safeLimit,
          include: {
            user: true
          }
        });

  const result: LeaderboardResponse = {
    scope,
    label,
    windowStart: windowStart?.toISOString(),
    windowEnd: windowEnd?.toISOString(),
    entries: sessions.map((session, index) => mapSessionToLeaderboardEntry(session, index + 1))
  };

  setCached(cacheKey, result);
  return result;
}

export async function getPersonalLeaderboards(runId: string, limit = 5): Promise<PersonalLeaderboardResponse | null> {
  const safeLimit = Math.min(Math.max(limit, 1), 20);
  const cacheKey = `personal:${runId}:${safeLimit}`;
  const cached = getCached<PersonalLeaderboardResponse | null>(cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  const baseRun = await prisma.gameSession.findUnique({
    where: { id: runId },
    include: {
      user: true
    }
  });

  if (!baseRun) {
    setCached(cacheKey, null);
    return null;
  }

  const personalWhere: Prisma.GameSessionWhereInput = {
    status: "COMPLETED",
    ...(baseRun.userId ? { userId: baseRun.userId } : { playerSessionId: baseRun.playerSessionId })
  };

  const [bestScores, recentRuns] = await Promise.all([
    prisma.gameSession.findMany({
      where: personalWhere,
      orderBy: [{ totalScore: "desc" }, { endedAt: "asc" }],
      take: safeLimit,
      include: {
        user: true
      }
    }),
    prisma.gameSession.findMany({
      where: personalWhere,
      orderBy: [{ endedAt: "desc" }, { startedAt: "desc" }],
      take: safeLimit,
      include: {
        user: true
      }
    })
  ]);

  const result: PersonalLeaderboardResponse = {
    runId,
    bestScores: bestScores.map((session) => mapSessionToPersonalRun(session)),
    recentRuns: recentRuns.map((session) => mapSessionToPersonalRun(session)),
    guestMode: !baseRun.userId
  };

  setCached(cacheKey, result);
  return result;
}

export async function getCurrentPersonalLeaderboards(input: {
  userId: string | null;
  playerSessionId: string | null;
  limit?: number;
}): Promise<PersonalLeaderboardResponse> {
  const safeLimit = Math.min(Math.max(input.limit ?? 5, 1), 20);
  const cacheKey = `personal-current:${input.userId ?? "guest"}:${input.playerSessionId ?? "none"}:${safeLimit}`;
  const cached = getCached<PersonalLeaderboardResponse>(cacheKey);

  if (cached) {
    return cached;
  }

  const where: Prisma.GameSessionWhereInput =
    input.userId
      ? {
          status: "COMPLETED",
          userId: input.userId
        }
      : {
          status: "COMPLETED",
          playerSessionId: input.playerSessionId ?? "__missing_player_session__"
        };

  const [bestScores, recentRuns] = await Promise.all([
    prisma.gameSession.findMany({
      where,
      orderBy: [{ totalScore: "desc" }, { endedAt: "asc" }],
      take: safeLimit
    }),
    prisma.gameSession.findMany({
      where,
      orderBy: [{ endedAt: "desc" }, { startedAt: "desc" }],
      take: safeLimit
    })
  ]);

  const result: PersonalLeaderboardResponse = {
    runId: recentRuns[0]?.id ?? (input.userId ? "account-history" : "guest-history"),
    bestScores: bestScores.map((session) => mapSessionToPersonalRun(session)),
    recentRuns: recentRuns.map((session) => mapSessionToPersonalRun(session)),
    guestMode: !input.userId
  };

  setCached(cacheKey, result);
  return result;
}

export function describeLeaderboardStrategy() {
  return {
    apiDesign: [
      "GET /api/v1/leaderboards?scope=global|daily|weekly&limit=25",
      "GET /api/v1/leaderboards/personal?runId=<session-id>&limit=5"
    ],
    queryStrategy: [
      "Global, daily, and weekly boards query completed game sessions ordered by score desc, then endedAt asc.",
      "Personal best and recent runs query completed sessions for the same user or guest playerSession.",
      "Short-lived in-memory cache smooths repeated leaderboard reads during active browsing."
    ],
    indexesNeeded: [
      "Existing: GameSession(mode, status, startedAt), GameSession(dailyChallengeId, totalScore), LeaderboardEntry(leaderboardId, score, recordedAt).",
      "Recommended next index if traffic grows: GameSession(status, endedAt desc, totalScore desc)."
    ],
    caching: [
      "15 second in-process cache for leaderboard and personal queries.",
      "Good candidate for Redis cache later if the API is horizontally scaled."
    ],
    guestHandling: [
      "Guest runs render as Guest <short-id> on shared boards.",
      "Personal bests for guests are scoped to the current playerSession until durable guest identity is added."
    ],
    antiSpam: [
      "Basic in-memory request limiting on leaderboard endpoints.",
      "Clamp leaderboard query limits to prevent oversized reads."
    ]
  };
}

async function buildScopeWindow(scope: LeaderboardScope) {
  const now = new Date();

  if (scope === "daily") {
    const dailyChallenge = await ensureDailyChallengeForDate(now);
    const windowStart = new Date(now);
    windowStart.setHours(0, 0, 0, 0);
    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() + 1);

    return {
      label: `Daily · ${formatDate(windowStart)}`,
      windowStart,
      windowEnd,
      where: {
        status: "COMPLETED",
        mode: "DAILY",
        dailyChallengeId: dailyChallenge?.id ?? "__missing_daily__"
      } satisfies Prisma.GameSessionWhereInput
    };
  }

  if (scope === "weekly") {
    const windowStart = new Date(now);
    const dayOffset = (windowStart.getDay() + 6) % 7;
    windowStart.setDate(windowStart.getDate() - dayOffset);
    windowStart.setHours(0, 0, 0, 0);
    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() + 7);

    return {
      label: `Weekly · ${formatDate(windowStart)}`,
      windowStart,
      windowEnd,
      where: {
        status: "COMPLETED",
        endedAt: {
          gte: windowStart,
          lt: windowEnd
        }
      } satisfies Prisma.GameSessionWhereInput
    };
  }

  return {
    label: "Global",
    windowStart: undefined,
    windowEnd: undefined,
    where: {
      status: "COMPLETED"
    } satisfies Prisma.GameSessionWhereInput
  };
}

async function getDailyBestSessions(limit: number, where: Prisma.GameSessionWhereInput) {
  const candidates = await prisma.gameSession.findMany({
    where,
    orderBy: [{ totalScore: "desc" }, { endedAt: "asc" }, { startedAt: "asc" }],
    take: Math.max(limit * 8, 50),
    include: {
      user: true
    }
  });

  const bestRuns = [];
  const seen = new Set<string>();

  for (const session of candidates) {
    const identity = session.userId ? `user:${session.userId}` : `guest:${session.playerSessionId}`;

    if (seen.has(identity)) {
      continue;
    }

    seen.add(identity);
    bestRuns.push(session);

    if (bestRuns.length >= limit) {
      break;
    }
  }

  return bestRuns;
}

function mapSessionToLeaderboardEntry(
  session: {
    id: string;
    totalScore: number;
    promptsCorrect: number;
    promptsAttempted: number;
    endedAt: Date | null;
    mode: "PRACTICE" | "DAILY" | "RANKED" | "MULTIPLAYER";
    playerSessionId: string;
    user: { username: string; displayName: string | null } | null;
  },
  rank: number
): LeaderboardEntryView {
  return {
    rank,
    runId: session.id,
    userName: session.user?.displayName ?? session.user?.username ?? `Guest ${session.playerSessionId.slice(0, 8)}`,
    score: session.totalScore,
    accuracy: session.promptsAttempted > 0 ? session.promptsCorrect / session.promptsAttempted : 0,
    solvedCount: session.promptsCorrect,
    isGuest: !session.user,
    mode: session.mode.toLowerCase() as LeaderboardEntryView["mode"],
    createdAt: formatDate(session.endedAt ?? new Date())
  };
}

function mapSessionToPersonalRun(session: {
  id: string;
  totalScore: number;
  promptsCorrect: number;
  promptsAttempted: number;
  endedAt: Date | null;
  startedAt: Date;
}): PersonalRunView {
  return {
    runId: session.id,
    label: formatDateTime(session.endedAt ?? session.startedAt),
    score: session.totalScore,
    accuracy: session.promptsAttempted > 0 ? session.promptsCorrect / session.promptsAttempted : 0,
    solvedCount: session.promptsCorrect,
    endedAt: (session.endedAt ?? session.startedAt).toISOString()
  };
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(date);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function getCached<T>(key: string) {
  const hit = cache.get(key);

  if (!hit) {
    return undefined;
  }

  if (Date.now() >= hit.expiresAt) {
    cache.delete(key);
    return undefined;
  }

  return hit.value as T;
}

function setCached(key: string, value: unknown) {
  cache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value
  });
}
