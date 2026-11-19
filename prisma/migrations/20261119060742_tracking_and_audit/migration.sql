-- AlterTable
ALTER TABLE "RankSnapshot" ADD COLUMN     "costUsd" DECIMAL(12,6) NOT NULL DEFAULT 0,
ADD COLUMN     "error" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'live',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'done';

-- AlterTable
ALTER TABLE "SiteAuditCrawl" ADD COLUMN     "error" TEXT,
ADD COLUMN     "progress" JSONB,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'live';

-- AlterTable
ALTER TABLE "TrackedKeyword" ADD COLUMN     "searchVolume" INTEGER;

-- AlterTable
ALTER TABLE "TrackingProject" ADD COLUMN     "depth" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "lastCheckedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "RankSnapshot_status_idx" ON "RankSnapshot"("status");

-- CreateIndex
CREATE INDEX "SiteAuditCrawl_target_createdAt_idx" ON "SiteAuditCrawl"("target", "createdAt");
