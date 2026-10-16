import dotenv from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

const configDir = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: resolve(configDir, ".env") });

// For Prisma CLI (migrations), use the session-mode direct URL (port 5432).
// The pooled DATABASE_URL (port 6543 via PgBouncer) is used at runtime by
// the PrismaClient in application code, not here.
const migrationUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!migrationUrl) {
  throw new Error("DIRECT_URL or DATABASE_URL is missing from backend/.env");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationUrl,
  },
});
