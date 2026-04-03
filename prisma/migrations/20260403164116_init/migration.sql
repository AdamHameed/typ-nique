-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "SessionMode" AS ENUM ('PRACTICE', 'DAILY', 'RANKED', 'MULTIPLAYER');

-- CreateEnum
CREATE TYPE "GameSessionStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "SubmissionVerdict" AS ENUM ('CORRECT', 'INCORRECT', 'COMPILE_ERROR', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "MatchTier" AS ENUM ('EXACT', 'NORMALIZED', 'RENDERED', 'ALTERNATE', 'NONE');

-- CreateEnum
CREATE TYPE "ArtifactRole" AS ENUM ('CANONICAL', 'ALTERNATE', 'REFERENCE');

-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('CANONICAL', 'ALTERNATE');

-- CreateEnum
CREATE TYPE "DailyChallengeStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ScoreType" AS ENUM ('ROUND', 'BONUS', 'PENALTY', 'FINAL');

-- CreateEnum
CREATE TYPE "LeaderboardScope" AS ENUM ('GLOBAL', 'DAILY', 'WEEKLY', 'SEASONAL');

-- CreateEnum
CREATE TYPE "MultiplayerMode" AS ENUM ('ASYNC', 'LIVE');

-- CreateEnum
CREATE TYPE "MultiplayerMatchStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "username" VARCHAR(40) NOT NULL,
    "email" VARCHAR(255),
    "passwordHash" TEXT,
    "displayName" VARCHAR(80),
    "avatarUrl" TEXT,
    "skillRating" INTEGER NOT NULL DEFAULT 1000,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerSession" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "guestTokenHash" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6),

    CONSTRAINT "PlayerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeCategory" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "categoryId" UUID NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'DRAFT',
    "canonicalSource" TEXT NOT NULL,
    "normalizedCanonicalSource" TEXT NOT NULL,
    "checkerVersion" INTEGER NOT NULL DEFAULT 1,
    "canonicalArtifactId" UUID,
    "timeTargetMs" INTEGER,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeTag" (
    "challengeId" UUID NOT NULL,
    "tagId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeTag_pkey" PRIMARY KEY ("challengeId","tagId")
);

-- CreateTable
CREATE TABLE "ChallengeRenderArtifact" (
    "id" UUID NOT NULL,
    "challengeId" UUID NOT NULL,
    "artifactRole" "ArtifactRole" NOT NULL,
    "sourceKind" "SourceKind" NOT NULL,
    "sourceHash" CHAR(64) NOT NULL,
    "svgStorageKey" TEXT,
    "svgInline" TEXT,
    "normalizedSvgHash" CHAR(64) NOT NULL,
    "structuralFingerprint" JSONB,
    "typstVersion" VARCHAR(40),
    "renderEngineVersion" VARCHAR(40),
    "compileDurationMs" INTEGER,
    "widthPx" INTEGER,
    "heightPx" INTEGER,
    "viewBox" VARCHAR(120),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeRenderArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeAlternateSource" (
    "id" UUID NOT NULL,
    "challengeId" UUID NOT NULL,
    "sourceText" TEXT NOT NULL,
    "normalizedSource" TEXT NOT NULL,
    "artifactId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeAlternateSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyChallenge" (
    "id" UUID NOT NULL,
    "challengeDate" DATE NOT NULL,
    "title" VARCHAR(160),
    "seed" VARCHAR(120) NOT NULL,
    "status" "DailyChallengeStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyChallengeItem" (
    "id" UUID NOT NULL,
    "dailyChallengeId" UUID NOT NULL,
    "challengeId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyChallengeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MultiplayerMatch" (
    "id" UUID NOT NULL,
    "mode" "MultiplayerMode" NOT NULL,
    "status" "MultiplayerMatchStatus" NOT NULL DEFAULT 'PENDING',
    "seed" VARCHAR(120) NOT NULL,
    "startedAt" TIMESTAMPTZ(6),
    "endedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MultiplayerMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" UUID NOT NULL,
    "playerSessionId" UUID NOT NULL,
    "userId" UUID,
    "mode" "SessionMode" NOT NULL,
    "status" "GameSessionStatus" NOT NULL DEFAULT 'PENDING',
    "dailyChallengeId" UUID,
    "matchId" UUID,
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ(6),
    "timeLimitMs" INTEGER,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "accuracy" DECIMAL(5,4),
    "promptsAttempted" INTEGER NOT NULL DEFAULT 0,
    "promptsCorrect" INTEGER NOT NULL DEFAULT 0,
    "seed" VARCHAR(120),
    "metadata" JSONB,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameRound" (
    "id" UUID NOT NULL,
    "gameSessionId" UUID NOT NULL,
    "challengeId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "presentedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ(6),
    "bestSubmissionId" UUID,
    "finalVerdict" "SubmissionVerdict",
    "finalMatchTier" "MatchTier",
    "timeTakenMs" INTEGER,
    "scoreAwarded" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,

    CONSTRAINT "GameRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" UUID NOT NULL,
    "gameRoundId" UUID NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "submittedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawSource" TEXT NOT NULL,
    "normalizedSource" TEXT NOT NULL,
    "sourceHash" CHAR(64) NOT NULL,
    "checkerVersion" INTEGER NOT NULL,
    "verdict" "SubmissionVerdict" NOT NULL,
    "matchTier" "MatchTier" NOT NULL,
    "isAccepted" BOOLEAN NOT NULL DEFAULT false,
    "feedback" TEXT,
    "compileError" TEXT,
    "compileDurationMs" INTEGER,
    "compareDurationMs" INTEGER,
    "timeFromRoundStartMs" INTEGER,
    "renderFingerprint" CHAR(64),
    "renderMetadata" JSONB,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionRenderArtifact" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "svgStorageKey" TEXT,
    "svgInline" TEXT,
    "normalizedSvgHash" CHAR(64),
    "structuralFingerprint" JSONB,
    "bboxMetadata" JSONB,
    "typstVersion" VARCHAR(40),
    "renderEngineVersion" VARCHAR(40),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionRenderArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreRecord" (
    "id" UUID NOT NULL,
    "gameSessionId" UUID NOT NULL,
    "gameRoundId" UUID,
    "userId" UUID,
    "scoreType" "ScoreType" NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "ScoreRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Leaderboard" (
    "id" UUID NOT NULL,
    "scope" "LeaderboardScope" NOT NULL,
    "scopeKey" VARCHAR(120) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "startsAt" TIMESTAMPTZ(6),
    "endsAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Leaderboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardEntry" (
    "id" UUID NOT NULL,
    "leaderboardId" UUID NOT NULL,
    "userId" UUID,
    "gameSessionId" UUID NOT NULL,
    "displayName" VARCHAR(80) NOT NULL,
    "score" INTEGER NOT NULL,
    "accuracy" DECIMAL(5,4) NOT NULL,
    "rank" INTEGER,
    "recordedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MultiplayerMatchPlayer" (
    "id" UUID NOT NULL,
    "multiplayerMatchId" UUID NOT NULL,
    "userId" UUID,
    "playerSessionId" UUID,
    "gameSessionId" UUID,
    "joinedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalPlace" INTEGER,

    CONSTRAINT "MultiplayerMatchPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "PlayerSession_userId_idx" ON "PlayerSession"("userId");

-- CreateIndex
CREATE INDEX "PlayerSession_guestTokenHash_idx" ON "PlayerSession"("guestTokenHash");

-- CreateIndex
CREATE INDEX "PlayerSession_lastSeenAt_idx" ON "PlayerSession"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeCategory_slug_key" ON "ChallengeCategory"("slug");

-- CreateIndex
CREATE INDEX "ChallengeCategory_sortOrder_idx" ON "ChallengeCategory"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Challenge_slug_key" ON "Challenge"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Challenge_canonicalArtifactId_key" ON "Challenge"("canonicalArtifactId");

-- CreateIndex
CREATE INDEX "Challenge_status_categoryId_difficulty_idx" ON "Challenge"("status", "categoryId", "difficulty");

-- CreateIndex
CREATE INDEX "Challenge_createdByUserId_idx" ON "Challenge"("createdByUserId");

-- CreateIndex
CREATE INDEX "ChallengeTag_tagId_idx" ON "ChallengeTag"("tagId");

-- CreateIndex
CREATE INDEX "ChallengeRenderArtifact_challengeId_idx" ON "ChallengeRenderArtifact"("challengeId");

-- CreateIndex
CREATE INDEX "ChallengeRenderArtifact_normalizedSvgHash_idx" ON "ChallengeRenderArtifact"("normalizedSvgHash");

-- CreateIndex
CREATE INDEX "ChallengeRenderArtifact_challengeId_artifactRole_idx" ON "ChallengeRenderArtifact"("challengeId", "artifactRole");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeRenderArtifact_challengeId_artifactRole_normalized_key" ON "ChallengeRenderArtifact"("challengeId", "artifactRole", "normalizedSvgHash");

-- CreateIndex
CREATE INDEX "ChallengeAlternateSource_challengeId_idx" ON "ChallengeAlternateSource"("challengeId");

-- CreateIndex
CREATE INDEX "ChallengeAlternateSource_normalizedSource_idx" ON "ChallengeAlternateSource"("normalizedSource");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeAlternateSource_challengeId_normalizedSource_key" ON "ChallengeAlternateSource"("challengeId", "normalizedSource");

-- CreateIndex
CREATE UNIQUE INDEX "DailyChallenge_challengeDate_key" ON "DailyChallenge"("challengeDate");

-- CreateIndex
CREATE INDEX "DailyChallenge_status_idx" ON "DailyChallenge"("status");

-- CreateIndex
CREATE INDEX "DailyChallengeItem_challengeId_idx" ON "DailyChallengeItem"("challengeId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyChallengeItem_dailyChallengeId_position_key" ON "DailyChallengeItem"("dailyChallengeId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "DailyChallengeItem_dailyChallengeId_challengeId_key" ON "DailyChallengeItem"("dailyChallengeId", "challengeId");

-- CreateIndex
CREATE INDEX "MultiplayerMatch_status_createdAt_idx" ON "MultiplayerMatch"("status", "createdAt");

-- CreateIndex
CREATE INDEX "GameSession_userId_idx" ON "GameSession"("userId");

-- CreateIndex
CREATE INDEX "GameSession_playerSessionId_idx" ON "GameSession"("playerSessionId");

-- CreateIndex
CREATE INDEX "GameSession_mode_status_startedAt_idx" ON "GameSession"("mode", "status", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "GameSession_dailyChallengeId_totalScore_idx" ON "GameSession"("dailyChallengeId", "totalScore" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GameRound_bestSubmissionId_key" ON "GameRound"("bestSubmissionId");

-- CreateIndex
CREATE INDEX "GameRound_gameSessionId_idx" ON "GameRound"("gameSessionId");

-- CreateIndex
CREATE INDEX "GameRound_challengeId_idx" ON "GameRound"("challengeId");

-- CreateIndex
CREATE INDEX "GameRound_gameSessionId_position_idx" ON "GameRound"("gameSessionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "GameRound_gameSessionId_position_key" ON "GameRound"("gameSessionId", "position");

-- CreateIndex
CREATE INDEX "Submission_gameRoundId_idx" ON "Submission"("gameRoundId");

-- CreateIndex
CREATE INDEX "Submission_gameRoundId_submittedAt_idx" ON "Submission"("gameRoundId", "submittedAt");

-- CreateIndex
CREATE INDEX "Submission_verdict_matchTier_idx" ON "Submission"("verdict", "matchTier");

-- CreateIndex
CREATE INDEX "Submission_renderFingerprint_idx" ON "Submission"("renderFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_gameRoundId_attemptNumber_key" ON "Submission"("gameRoundId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionRenderArtifact_submissionId_key" ON "SubmissionRenderArtifact"("submissionId");

-- CreateIndex
CREATE INDEX "SubmissionRenderArtifact_normalizedSvgHash_idx" ON "SubmissionRenderArtifact"("normalizedSvgHash");

-- CreateIndex
CREATE INDEX "ScoreRecord_gameSessionId_idx" ON "ScoreRecord"("gameSessionId");

-- CreateIndex
CREATE INDEX "ScoreRecord_userId_idx" ON "ScoreRecord"("userId");

-- CreateIndex
CREATE INDEX "ScoreRecord_createdAt_idx" ON "ScoreRecord"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Leaderboard_scope_scopeKey_key" ON "Leaderboard"("scope", "scopeKey");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_leaderboardId_score_recordedAt_idx" ON "LeaderboardEntry"("leaderboardId", "score" DESC, "recordedAt");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_leaderboardId_rank_idx" ON "LeaderboardEntry"("leaderboardId", "rank");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_userId_idx" ON "LeaderboardEntry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardEntry_leaderboardId_gameSessionId_key" ON "LeaderboardEntry"("leaderboardId", "gameSessionId");

-- CreateIndex
CREATE INDEX "MultiplayerMatchPlayer_multiplayerMatchId_idx" ON "MultiplayerMatchPlayer"("multiplayerMatchId");

-- CreateIndex
CREATE INDEX "MultiplayerMatchPlayer_userId_idx" ON "MultiplayerMatchPlayer"("userId");

-- AddForeignKey
ALTER TABLE "PlayerSession" ADD CONSTRAINT "PlayerSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ChallengeCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_canonicalArtifactId_fkey" FOREIGN KEY ("canonicalArtifactId") REFERENCES "ChallengeRenderArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeTag" ADD CONSTRAINT "ChallengeTag_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeTag" ADD CONSTRAINT "ChallengeTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeRenderArtifact" ADD CONSTRAINT "ChallengeRenderArtifact_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeAlternateSource" ADD CONSTRAINT "ChallengeAlternateSource_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeAlternateSource" ADD CONSTRAINT "ChallengeAlternateSource_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "ChallengeRenderArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyChallengeItem" ADD CONSTRAINT "DailyChallengeItem_dailyChallengeId_fkey" FOREIGN KEY ("dailyChallengeId") REFERENCES "DailyChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyChallengeItem" ADD CONSTRAINT "DailyChallengeItem_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_playerSessionId_fkey" FOREIGN KEY ("playerSessionId") REFERENCES "PlayerSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_dailyChallengeId_fkey" FOREIGN KEY ("dailyChallengeId") REFERENCES "DailyChallenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "MultiplayerMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRound" ADD CONSTRAINT "GameRound_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRound" ADD CONSTRAINT "GameRound_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRound" ADD CONSTRAINT "GameRound_bestSubmissionId_fkey" FOREIGN KEY ("bestSubmissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_gameRoundId_fkey" FOREIGN KEY ("gameRoundId") REFERENCES "GameRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionRenderArtifact" ADD CONSTRAINT "SubmissionRenderArtifact_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreRecord" ADD CONSTRAINT "ScoreRecord_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreRecord" ADD CONSTRAINT "ScoreRecord_gameRoundId_fkey" FOREIGN KEY ("gameRoundId") REFERENCES "GameRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreRecord" ADD CONSTRAINT "ScoreRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_leaderboardId_fkey" FOREIGN KEY ("leaderboardId") REFERENCES "Leaderboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MultiplayerMatchPlayer" ADD CONSTRAINT "MultiplayerMatchPlayer_multiplayerMatchId_fkey" FOREIGN KEY ("multiplayerMatchId") REFERENCES "MultiplayerMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MultiplayerMatchPlayer" ADD CONSTRAINT "MultiplayerMatchPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MultiplayerMatchPlayer" ADD CONSTRAINT "MultiplayerMatchPlayer_playerSessionId_fkey" FOREIGN KEY ("playerSessionId") REFERENCES "PlayerSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MultiplayerMatchPlayer" ADD CONSTRAINT "MultiplayerMatchPlayer_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
