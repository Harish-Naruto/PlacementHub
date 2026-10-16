/**
 * Direct SQL migration script — applies schema changes to remote Supabase DB.
 * Run with: bun run prisma/apply-schema.mjs
 *
 * Uses DATABASE_URL from backend/.env (Supabase pooler port 6543).
 */
import pg from "pg";

// Hard-read the .env file ourselves to avoid shell env overrides
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env");

let DATABASE_URL = "";
try {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("DATABASE_URL=")) {
      DATABASE_URL = trimmed.replace("DATABASE_URL=", "").replace(/^"|"$/g, "").trim();
      break;
    }
  }
} catch {
  console.error("❌ Could not read .env at", envPath);
  process.exit(1);
}

if (!DATABASE_URL || DATABASE_URL.includes("localhost")) {
  console.error("❌ DATABASE_URL is missing or is localhost. Check backend/.env");
  console.log("Resolved env path:", envPath);
  process.exit(1);
}

console.log("🔌 Connecting to:", DATABASE_URL.replace(/:([^:@]+)@/, ":***@").slice(0, 80) + "...");

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log("✅ Connected to remote Supabase DB");
} catch (err) {
  console.error("❌ Connection failed:", err.message);
  process.exit(1);
}

const sql = `
-- 1. Make institutionId optional on StudentProfile
ALTER TABLE "StudentProfile" ALTER COLUMN "institutionId" DROP NOT NULL;

-- 2. Create Resume table (idempotent)
CREATE TABLE IF NOT EXISTS "Resume" (
  "id"               UUID          NOT NULL DEFAULT gen_random_uuid(),
  "studentProfileId" UUID          NOT NULL,
  "originalName"     VARCHAR(255)  NOT NULL,
  "storagePath"      VARCHAR(1024) NOT NULL,
  "mimeType"         VARCHAR(100)  NOT NULL,
  "sizeBytes"        INTEGER       NOT NULL,
  "isPrimary"        BOOLEAN       NOT NULL DEFAULT false,
  "createdAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "Resume_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Resume_studentProfileId_idx" ON "Resume"("studentProfileId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Resume_studentProfileId_fkey'
  ) THEN
    ALTER TABLE "Resume" ADD CONSTRAINT "Resume_studentProfileId_fkey"
      FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Replace old resumeUrl text column with proper resumeId FK
ALTER TABLE "Application" DROP COLUMN IF EXISTS "resumeUrl";
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "resumeId" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Application_resumeId_fkey'
  ) THEN
    ALTER TABLE "Application" ADD CONSTRAINT "Application_resumeId_fkey"
      FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE SET NULL;
  END IF;
END $$;
`;

try {
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log("✅ All schema changes applied successfully to Supabase");
} catch (err) {
  await client.query("ROLLBACK");
  console.error("❌ Schema migration failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
