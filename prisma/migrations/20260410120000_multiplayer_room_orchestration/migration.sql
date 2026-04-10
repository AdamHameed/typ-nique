-- AlterTable
ALTER TABLE "MultiplayerMatch"
ADD COLUMN "metadata" JSONB;

-- AlterTable
ALTER TABLE "MultiplayerMatchPlayer"
ADD COLUMN "readyAt" TIMESTAMPTZ(6),
ADD COLUMN "leftAt" TIMESTAMPTZ(6),
ADD COLUMN "finishedAt" TIMESTAMPTZ(6);
