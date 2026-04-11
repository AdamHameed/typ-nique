-- CreateEnum
CREATE TYPE "MultiplayerPlayerConnectionStatus" AS ENUM ('CONNECTED', 'IDLE', 'DISCONNECTED', 'LEFT');

-- AlterEnum
ALTER TYPE "MultiplayerMatchStatus" ADD VALUE IF NOT EXISTS 'COUNTDOWN';

-- AlterTable
ALTER TABLE "MultiplayerMatch"
ADD COLUMN "roomCode" VARCHAR(12),
ADD COLUMN "hostPlayerId" UUID,
ADD COLUMN "maxPlayers" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN "rulesVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "countdownDurationMs" INTEGER NOT NULL DEFAULT 5000,
ADD COLUMN "countdownEndsAt" TIMESTAMPTZ(6),
ADD COLUMN "challengeIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
ADD COLUMN "startedRoundIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "roomVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Rename legacy room completion timestamp
ALTER TABLE "MultiplayerMatch" RENAME COLUMN "endedAt" TO "finishedAt";

-- Backfill explicit room columns from legacy metadata where possible
UPDATE "MultiplayerMatch"
SET
  "roomCode" = COALESCE("roomCode", UPPER(SUBSTRING(REPLACE("id"::text, '-', '') FROM 1 FOR 8))),
  "maxPlayers" = COALESCE(("metadata"->>'maxPlayers')::INTEGER, "maxPlayers"),
  "rulesVersion" = COALESCE(("metadata"->>'rulesVersion')::INTEGER, "rulesVersion"),
  "countdownDurationMs" = COALESCE(("metadata"->>'countdownDurationMs')::INTEGER, "countdownDurationMs"),
  "countdownEndsAt" = COALESCE(("metadata"->>'countdownEndsAt')::TIMESTAMPTZ, "countdownEndsAt"),
  "challengeIds" = CASE
    WHEN jsonb_typeof("metadata"->'challengeIds') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text("metadata"->'challengeIds')::UUID)
    ELSE "challengeIds"
  END,
  "updatedAt" = COALESCE("startedAt", "createdAt");

-- Set room host to earliest joined player when missing
UPDATE "MultiplayerMatch" AS match
SET "hostPlayerId" = first_player."id"
FROM (
  SELECT DISTINCT ON ("multiplayerMatchId")
    "id",
    "multiplayerMatchId"
  FROM "MultiplayerMatchPlayer"
  ORDER BY "multiplayerMatchId", "joinedAt" ASC
) AS first_player
WHERE match."id" = first_player."multiplayerMatchId"
  AND match."hostPlayerId" IS NULL;

-- Enforce roomCode after backfill
ALTER TABLE "MultiplayerMatch"
ALTER COLUMN "roomCode" SET NOT NULL;

-- Remove generic metadata now that room state is explicit
ALTER TABLE "MultiplayerMatch"
DROP COLUMN "metadata";

-- AlterTable
ALTER TABLE "MultiplayerMatchPlayer"
ADD COLUMN "displayName" VARCHAR(80),
ADD COLUMN "connectionStatus" "MultiplayerPlayerConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
ADD COLUMN "lastHeartbeatAt" TIMESTAMPTZ(6);

-- Backfill display name and heartbeat for existing memberships
UPDATE "MultiplayerMatchPlayer" AS player
SET
  "displayName" = COALESCE(
    player."displayName",
    user_row."displayName",
    user_row."username",
    CONCAT('Guest ', LEFT(COALESCE(player."playerSessionId"::text, player."id"::text), 6))
  ),
  "lastHeartbeatAt" = COALESCE(player."lastHeartbeatAt", player."joinedAt")
FROM "User" AS user_row
WHERE player."userId" = user_row."id";

UPDATE "MultiplayerMatchPlayer" AS player
SET
  "displayName" = COALESCE(
    player."displayName",
    CONCAT('Guest ', LEFT(COALESCE(player."playerSessionId"::text, player."id"::text), 6))
  ),
  "lastHeartbeatAt" = COALESCE(player."lastHeartbeatAt", player."joinedAt")
WHERE player."displayName" IS NULL;

ALTER TABLE "MultiplayerMatchPlayer"
ALTER COLUMN "displayName" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "MultiplayerMatch_roomCode_key" ON "MultiplayerMatch"("roomCode");

-- CreateIndex
CREATE INDEX "MultiplayerMatch_status_countdownEndsAt_idx" ON "MultiplayerMatch"("status", "countdownEndsAt");

-- CreateIndex
CREATE INDEX "MultiplayerMatch_finishedAt_idx" ON "MultiplayerMatch"("finishedAt");

-- CreateIndex
CREATE INDEX "MultiplayerMatch_updatedAt_idx" ON "MultiplayerMatch"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MultiplayerMatchPlayer_matchId_userId_key" ON "MultiplayerMatchPlayer"("multiplayerMatchId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MultiplayerMatchPlayer_matchId_playerSessionId_key" ON "MultiplayerMatchPlayer"("multiplayerMatchId", "playerSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "MultiplayerMatchPlayer_matchId_gameSessionId_key" ON "MultiplayerMatchPlayer"("multiplayerMatchId", "gameSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "MultiplayerMatchPlayer_matchId_finalPlace_key" ON "MultiplayerMatchPlayer"("multiplayerMatchId", "finalPlace");

-- CreateIndex
CREATE INDEX "MultiplayerMatchPlayer_matchId_joinedAt_idx" ON "MultiplayerMatchPlayer"("multiplayerMatchId", "joinedAt");

-- CreateIndex
CREATE INDEX "MultiplayerMatchPlayer_matchId_finalPlace_idx" ON "MultiplayerMatchPlayer"("multiplayerMatchId", "finalPlace");

-- CreateIndex
CREATE INDEX "MultiplayerMatchPlayer_matchId_connectionStatus_lastHeartbeatAt_idx" ON "MultiplayerMatchPlayer"("multiplayerMatchId", "connectionStatus", "lastHeartbeatAt");

-- CreateIndex
CREATE INDEX "MultiplayerMatchPlayer_playerSessionId_idx" ON "MultiplayerMatchPlayer"("playerSessionId");

-- AddForeignKey
ALTER TABLE "MultiplayerMatch"
ADD CONSTRAINT "MultiplayerMatch_hostPlayerId_fkey"
FOREIGN KEY ("hostPlayerId") REFERENCES "MultiplayerMatchPlayer"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
