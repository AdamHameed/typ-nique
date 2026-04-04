import { Prisma } from "@prisma/client";
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { normalizeSource, normalizeSvgMarkup, svgFingerprint } from "@typ-nique/typst-utils";
import { prisma } from "../src/index.js";
import { demoUsers, leaderboardSeeds } from "../seeds/demo-data.js";
import {
  buildChallengeDescription,
  categoryLabelFromSlug,
  difficultyToRank,
  loadChallengePack,
  normalizeAlternateSources
} from "../seeds/lib/content-loader.js";

function buildCanonicalArtifact(svg: string) {
  const normalizedSvg = normalizeSvgMarkup(svg);

  return {
    sourceHash: createHash("sha256").update(svg).digest("hex"),
    normalizedSvgHash: svgFingerprint(normalizedSvg),
    svgInline: svg,
    viewBox: "0 0 560 140",
    widthPx: 560,
    heightPx: 140
  };
}

async function main() {
  const pack = await loadChallengePack();
  const categorySlugs = [...new Set(pack.challenges.map((challenge) => challenge.category))];
  const tagSlugs = [...new Set(pack.challenges.flatMap((challenge) => challenge.tags))].sort();

  for (const [index, categorySlug] of categorySlugs.entries()) {
    await prisma.challengeCategory.upsert({
      where: { slug: categorySlug },
      update: {
        name: categoryLabelFromSlug(categorySlug),
        description: `Challenge prompts for ${categoryLabelFromSlug(categorySlug)}.`,
        sortOrder: index + 1
      },
      create: {
        slug: categorySlug,
        name: categoryLabelFromSlug(categorySlug),
        description: `Challenge prompts for ${categoryLabelFromSlug(categorySlug)}.`,
        sortOrder: index + 1
      }
    });
  }

  for (const tagSlug of tagSlugs) {
    await prisma.tag.upsert({
      where: { slug: tagSlug },
      update: {
        label: tagSlug
          .split("-")
          .map((segment) => segment[0]!.toUpperCase() + segment.slice(1))
          .join(" ")
      },
      create: {
        slug: tagSlug,
        label: tagSlug
          .split("-")
          .map((segment) => segment[0]!.toUpperCase() + segment.slice(1))
          .join(" ")
      }
    });
  }

  for (const user of demoUsers) {
    await prisma.user.upsert({
      where: { username: user.username },
      update: {
        displayName: user.displayName,
        email: user.email,
        passwordHash: buildPasswordHash("typnique-demo")
      },
      create: {
        ...user,
        passwordHash: buildPasswordHash("typnique-demo")
      }
    });
  }

  for (const seed of pack.challenges) {
    const category = await prisma.challengeCategory.findUniqueOrThrow({
      where: { slug: seed.category }
    });

    const challenge = await prisma.challenge.upsert({
      where: { slug: seed.slug },
      update: {
        title: seed.title,
        description: buildChallengeDescription(seed.hint, seed.explanation),
        categoryId: category.id,
        difficulty: difficultyToRank(seed.difficulty),
        status: seed.status === "active" ? "ACTIVE" : "RETIRED",
        canonicalSource: seed.canonical_typst_source,
        normalizedCanonicalSource: normalizeSource(seed.canonical_typst_source),
        checkerVersion: 1,
        timeTargetMs: seed.estimated_solve_time * 1000
      },
      create: {
        slug: seed.slug,
        title: seed.title,
        description: buildChallengeDescription(seed.hint, seed.explanation),
        categoryId: category.id,
        difficulty: difficultyToRank(seed.difficulty),
        status: seed.status === "active" ? "ACTIVE" : "RETIRED",
        canonicalSource: seed.canonical_typst_source,
        normalizedCanonicalSource: normalizeSource(seed.canonical_typst_source),
        checkerVersion: 1,
        timeTargetMs: seed.estimated_solve_time * 1000
      }
    });

    await prisma.challengeTag.deleteMany({
      where: { challengeId: challenge.id }
    });

    for (const tagSlug of seed.tags) {
      const tag = await prisma.tag.findUniqueOrThrow({
        where: { slug: tagSlug }
      });

      await prisma.challengeTag.create({
        data: {
          challengeId: challenge.id,
          tagId: tag.id
        }
      });
    }

    await prisma.challenge.update({
      where: { id: challenge.id },
      data: {
        canonicalArtifactId: null
      }
    });

    await prisma.challengeAlternateSource.deleteMany({
      where: { challengeId: challenge.id }
    });

    await prisma.challengeRenderArtifact.deleteMany({
      where: { challengeId: challenge.id }
    });

    if (seed.target_render_svg) {
      const artifact = await prisma.challengeRenderArtifact.create({
        data: {
          challengeId: challenge.id,
          artifactRole: "CANONICAL",
          sourceKind: "CANONICAL",
          ...buildCanonicalArtifact(seed.target_render_svg)
        }
      });

      await prisma.challenge.update({
        where: { id: challenge.id },
        data: {
          canonicalArtifactId: artifact.id
        }
      });
    }

    for (const alternate of normalizeAlternateSources(seed.accepted_alternate_sources)) {
      await prisma.challengeAlternateSource.create({
        data: {
          challengeId: challenge.id,
          sourceText: alternate.sourceText,
          normalizedSource: alternate.normalizedSource
        }
      });
    }
  }

  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const tomorrowDate = new Date(todayDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const dailyScopeKey = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${String(
    todayDate.getDate()
  ).padStart(2, "0")}`;

  const dailyChallenge = await prisma.dailyChallenge.upsert({
    where: { challengeDate: todayDate },
    update: {
      title: "Daily Sprint",
      seed: `daily-${dailyScopeKey}`,
      status: "ACTIVE"
    },
    create: {
      challengeDate: todayDate,
      title: "Daily Sprint",
      seed: `daily-${dailyScopeKey}`,
      status: "ACTIVE"
    }
  });

  await prisma.dailyChallenge.updateMany({
    where: {
      id: { not: dailyChallenge.id },
      status: "ACTIVE"
    },
    data: {
      status: "ARCHIVED"
    }
  });

  await prisma.dailyChallengeItem.deleteMany({
    where: { dailyChallengeId: dailyChallenge.id }
  });

  const activeChallenges = await prisma.challenge.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "asc" }
  });

  for (const [index, challenge] of activeChallenges.entries()) {
    await prisma.dailyChallengeItem.create({
      data: {
        dailyChallengeId: dailyChallenge.id,
        challengeId: challenge.id,
        position: index + 1
      }
    });
  }

  const leaderboard = await prisma.leaderboard.upsert({
    where: {
      scope_scopeKey: {
        scope: "DAILY",
        scopeKey: dailyScopeKey
      }
    },
    update: {
      title: "Daily Leaderboard"
    },
    create: {
      scope: "DAILY",
      scopeKey: dailyScopeKey,
      title: "Daily Leaderboard",
      startsAt: todayDate,
      endsAt: tomorrowDate
    }
  });

  await prisma.leaderboardEntry.deleteMany({
    where: { leaderboardId: leaderboard.id }
  });

  for (const entry of leaderboardSeeds) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { username: entry.username }
    });

    const playerSession = await prisma.playerSession.create({
      data: {
        userId: user.id
      }
    });

    const gameSession = await prisma.gameSession.create({
      data: {
        playerSessionId: playerSession.id,
        userId: user.id,
        mode: "DAILY",
        status: "COMPLETED",
        dailyChallengeId: dailyChallenge.id,
        startedAt: new Date(todayDate.getTime() + 12 * 60 * 60 * 1000),
        endedAt: new Date(todayDate.getTime() + 12 * 60 * 60 * 1000 + 4 * 60 * 1000),
        totalScore: entry.score,
        accuracy: new Prisma.Decimal(entry.accuracy),
        promptsAttempted: 3,
        promptsCorrect: 3,
        seed: `daily-${dailyScopeKey}`
      }
    });

    await prisma.leaderboardEntry.create({
      data: {
        leaderboardId: leaderboard.id,
        userId: user.id,
        gameSessionId: gameSession.id,
        displayName: user.displayName ?? user.username,
        score: entry.score,
        accuracy: new Prisma.Decimal(entry.accuracy),
        rank: entry.rank
      }
    });
  }

  console.log("Seed data inserted.");
}

function buildPasswordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
