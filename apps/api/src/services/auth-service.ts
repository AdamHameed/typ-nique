import type { AuthSessionView, PersonalLeaderboardResponse, PersonalRunView } from "@typ-nique/types";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../lib/auth.js";

export async function registerUser(input: {
  username: string;
  password: string;
  displayName?: string;
}) {
  const existing = await prisma.user.findUnique({
    where: { username: input.username }
  });

  if (existing) {
    throw new Error("Username is already taken.");
  }

  return prisma.user.create({
    data: {
      username: input.username,
      email: null,
      displayName: input.displayName?.trim() || input.username,
      passwordHash: hashPassword(input.password)
    }
  });
}

export async function authenticateUser(input: { identifier: string; password: string }) {
  const identifier = input.identifier.trim();
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username: identifier }, { email: identifier.toLowerCase() }]
    }
  });

  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    throw new Error("Invalid email, username, or password.");
  }

  return user;
}

export function toAuthSessionView(user: {
  id: string;
  username: string;
  email: string | null;
  displayName: string | null;
} | null): AuthSessionView {
  return {
    authenticated: Boolean(user),
    guest: !user,
    user: user
      ? {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName
        }
      : null
  };
}

export async function getUserHistory(userId: string, limit = 5): Promise<PersonalLeaderboardResponse> {
  const safeLimit = Math.min(Math.max(limit, 1), 20);
  const where = {
    status: "COMPLETED" as const,
    userId
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

  return {
    runId: recentRuns[0]?.id ?? "account-history",
    bestScores: bestScores.map(mapSessionToPersonalRun),
    recentRuns: recentRuns.map(mapSessionToPersonalRun),
    guestMode: false
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

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}
