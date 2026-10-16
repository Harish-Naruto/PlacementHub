import dotenv from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

const configDir = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: resolve(configDir, ".env") });

// For migrations we need a direct (non-pooled) connection.
// DIRECT_URL is the session-mode pooler (5432) — preferred for migrations.
// If 5432 is unreachable we fall back to the transaction-mode pooler (6543)
// after stripping the pgbouncer=true query param.
const rawDirect = process.env.DIRECT_URL;
const rawPooled = process.env.DATABASE_URL
  ?.replace("?pgbouncer=true", "")
  .replace("&pgbouncer=true", "");

const migrationUrl = rawDirect || rawPooled;

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
