-- Closes the gap between the first two migrations and the schema the auth code needs:
--   * User.passwordHash and a required email (password login)
--   * the AuthSession table (refresh-token sessions)
--   * StudentProfile.institutionId is optional
-- Idempotent: safe on a database that already had these applied by hand, and on a fresh one.

-- User: password hash. Existing rows get an empty hash, which never verifies, so those accounts must re-register.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP DEFAULT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE "email" IS NULL) THEN
    ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;
  END IF;
END $$;

-- AuthSession: stores only the SHA-256 hash of the opaque refresh token.
CREATE TABLE IF NOT EXISTS "AuthSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "tokenFamily" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "revokedAt" TIMESTAMPTZ(6),
    "lastUsedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");
CREATE INDEX IF NOT EXISTS "AuthSession_userId_idx" ON "AuthSession"("userId");
CREATE INDEX IF NOT EXISTS "AuthSession_tokenFamily_idx" ON "AuthSession"("tokenFamily");

ALTER TABLE "AuthSession" DROP CONSTRAINT IF EXISTS "AuthSession_userId_fkey";
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- StudentProfile: a profile can exist before an institution is chosen.
ALTER TABLE "StudentProfile" ALTER COLUMN "institutionId" DROP NOT NULL;
ALTER TABLE "StudentProfile" DROP CONSTRAINT IF EXISTS "StudentProfile_institutionId_fkey";
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
