import { createHash } from "node:crypto";
import type { ChallengePrompt } from "@typ-nique/types";
import { prisma } from "../lib/prisma.js";

function mapDifficulty(value: number): ChallengePrompt["difficulty"] {
  if (value <= 1) return "easy";
  if (value === 2) return "medium";
  return "hard";
}

function resolveInputMode(_categorySlug: string): ChallengePrompt["inputMode"] {
  return "math";
}

export async function getDailyChallenge(): Promise<ChallengePrompt | null> {
  const dailyChallenge = await ensureDailyChallengeForDate();

  const challenge = dailyChallenge?.items[0]?.challenge;

  if (!challenge || !challenge.canonicalArtifact) {
    return null;
  }

  return {
    id: challenge.id,
    slug: challenge.slug,
    title: challenge.title,
    category: challenge.category.slug as ChallengePrompt["category"],
    difficulty: mapDifficulty(challenge.difficulty),
    inputMode: resolveInputMode(challenge.category.slug),
    canonicalSource: challenge.canonicalSource,
    normalizedCanonicalSource: challenge.normalizedCanonicalSource,
    renderedSvg: challenge.canonicalArtifact.svgInline ?? "",
    acceptedAlternates: challenge.alternateSources.map((alternate) => alternate.sourceText)
  };
}

export async function getChallengeById(challengeId: string): Promise<ChallengePrompt | null> {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: {
      category: true,
      canonicalArtifact: true,
      alternateSources: true
    }
  });

  if (!challenge || !challenge.canonicalArtifact) {
    return null;
  }

  return {
    id: challenge.id,
    slug: challenge.slug,
    title: challenge.title,
    category: challenge.category.slug as ChallengePrompt["category"],
    difficulty: mapDifficulty(challenge.difficulty),
    inputMode: resolveInputMode(challenge.category.slug),
    canonicalSource: challenge.canonicalSource,
    normalizedCanonicalSource: challenge.normalizedCanonicalSource,
    renderedSvg: challenge.canonicalArtifact.svgInline ?? "",
    acceptedAlternates: challenge.alternateSources.map((alternate) => alternate.sourceText)
  };
}

export async function getChallengeRotation(limit?: number) {
  return prisma.challenge.findMany({
    where: { status: "ACTIVE" },
    include: {
      category: true,
      canonicalArtifact: true,
      alternateSources: true
    },
    ...(typeof limit === "number" ? { take: limit } : {}),
    orderBy: { createdAt: "asc" }
  });
}

export async function ensureDailyChallengeForDate(now = new Date()) {
  const challengeDate = startOfLocalDay(now);

  const existing = await prisma.dailyChallenge.findUnique({
    where: { challengeDate },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: {
          challenge: {
            include: {
              category: true,
              canonicalArtifact: true,
              alternateSources: true
            }
          }
        }
      }
    }
  });

  if (existing) {
    if (existing.status !== "ACTIVE") {
      await prisma.dailyChallenge.update({
        where: { id: existing.id },
        data: { status: "ACTIVE" }
      });
    }

    await archiveStaleDailyChallenges(challengeDate, existing.id);
    return existing;
  }

  const activeChallenges = await prisma.challenge.findMany({
    where: {
      status: "ACTIVE",
      canonicalArtifactId: {
        not: null
      }
    },
    include: {
      category: true,
      canonicalArtifact: true,
      alternateSources: true
    }
  });

  if (activeChallenges.length === 0) {
    return null;
  }

  const orderedChallenges = buildDailyChallengeOrder(activeChallenges, challengeDate);
  const scopeKey = formatDateKey(challengeDate);

  return prisma.$transaction(async (tx) => {
    await tx.dailyChallenge.updateMany({
      where: {
        status: "ACTIVE",
        challengeDate: {
          not: challengeDate
        }
      },
      data: {
        status: "ARCHIVED"
      }
    });

    const created = await tx.dailyChallenge.create({
      data: {
        challengeDate,
        title: `Daily Sprint · ${scopeKey}`,
        seed: `daily-${scopeKey}`,
        status: "ACTIVE"
      }
    });

    for (const [index, challenge] of orderedChallenges.entries()) {
      await tx.dailyChallengeItem.create({
        data: {
          dailyChallengeId: created.id,
          challengeId: challenge.id,
          position: index + 1
        }
      });
    }

    return tx.dailyChallenge.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        items: {
          orderBy: { position: "asc" },
          include: {
            challenge: {
              include: {
                category: true,
                canonicalArtifact: true,
                alternateSources: true
              }
            }
          }
        }
      }
    });
  });
}

function buildDailyChallengeOrder<T extends { slug: string }>(challenges: T[], challengeDate: Date) {
  const seed = formatDateKey(challengeDate);

  return [...challenges].sort((left, right) => {
    const leftKey = seededSortKey(seed, left.slug);
    const rightKey = seededSortKey(seed, right.slug);
    return leftKey.localeCompare(rightKey) || left.slug.localeCompare(right.slug);
  });
}

async function archiveStaleDailyChallenges(challengeDate: Date, keepId: string) {
  await prisma.dailyChallenge.updateMany({
    where: {
      status: "ACTIVE",
      id: {
        not: keepId
      },
      challengeDate: {
        not: challengeDate
      }
    },
    data: {
      status: "ARCHIVED"
    }
  });
}

function seededSortKey(seed: string, value: string) {
  return createHash("sha256").update(`${seed}:${value}`).digest("hex");
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
