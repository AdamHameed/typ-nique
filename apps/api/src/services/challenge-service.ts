import type { ChallengePrompt } from "@typ-nique/types";
import { prisma } from "../lib/prisma.js";

function mapDifficulty(value: number): ChallengePrompt["difficulty"] {
  if (value <= 1) return "easy";
  if (value === 2) return "medium";
  return "hard";
}

export async function getDailyChallenge(): Promise<ChallengePrompt | null> {
  const dailyChallenge = await prisma.dailyChallenge.findFirst({
    where: { status: "ACTIVE" },
    include: {
      items: {
        orderBy: { position: "asc" },
        take: 1,
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
    },
    orderBy: { challengeDate: "asc" }
  });

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
    canonicalSource: challenge.canonicalSource,
    normalizedCanonicalSource: challenge.normalizedCanonicalSource,
    renderedSvg: challenge.canonicalArtifact.svgInline ?? "",
    acceptedAlternates: challenge.alternateSources.map((alternate) => alternate.sourceText)
  };
}

export async function getChallengeRotation(limit = 10) {
  return prisma.challenge.findMany({
    where: { status: "ACTIVE" },
    include: {
      category: true,
      canonicalArtifact: true,
      alternateSources: true
    },
    take: limit,
    orderBy: { createdAt: "asc" }
  });
}
