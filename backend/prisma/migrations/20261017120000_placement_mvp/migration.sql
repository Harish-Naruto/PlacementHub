-- Placement MVP: placement role, stored skill scores, job ingestion fields, application snapshots.
-- Written to be idempotent (IF NOT EXISTS) because the remote database has drifted from earlier migrations.

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PLACEMENT';

ALTER TABLE "JobPosting" DROP CONSTRAINT IF EXISTS "JobPosting_recruiterProfileId_fkey";
ALTER TABLE "JobPosting"
  ADD COLUMN IF NOT EXISTS "companyId" UUID,
  ADD COLUMN IF NOT EXISTS "dedupeKey" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "origin" "JobSourceType" NOT NULL DEFAULT 'RECRUITER_POSTED',
  ADD COLUMN IF NOT EXISTS "parseMethod" VARCHAR(16),
  ADD COLUMN IF NOT EXISTS "sourceCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "JobPosting" ALTER COLUMN "recruiterProfileId" DROP NOT NULL;

ALTER TABLE "JobSource" ADD COLUMN IF NOT EXISTS "sourceLabel" VARCHAR(120);

ALTER TABLE "StudentSkill"
  ADD COLUMN IF NOT EXISTS "assessmentScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "combinedScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "evidenceStrength" VARCHAR(16),
  ADD COLUMN IF NOT EXISTS "githubScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "scoredAt" TIMESTAMPTZ(6);

ALTER TABLE "Application"
  ADD COLUMN IF NOT EXISTS "fitScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "fitSnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "resumeSnapshot" JSONB;

CREATE INDEX IF NOT EXISTS "JobPosting_companyId_idx" ON "JobPosting"("companyId");
CREATE INDEX IF NOT EXISTS "JobPosting_dedupeKey_idx" ON "JobPosting"("dedupeKey");

ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_recruiterProfileId_fkey"
  FOREIGN KEY ("recruiterProfileId") REFERENCES "RecruiterProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobPosting" DROP CONSTRAINT IF EXISTS "JobPosting_companyId_fkey";
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: existing jobs get their company from the recruiter who posted them.
UPDATE "JobPosting" j SET "companyId" = r."companyId"
FROM "RecruiterProfile" r
WHERE j."recruiterProfileId" = r."id" AND j."companyId" IS NULL;
