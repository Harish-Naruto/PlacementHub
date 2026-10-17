/**
 * Applies one SQL file to the database in backend/.env (DATABASE_URL).
 * Run with: bun run prisma/apply-sql.mjs prisma/migrations/<folder>/migration.sql
 * The SQL is sent as a single simple-query batch, so it must be idempotent.
 */
import pg from "pg";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const file = process.argv[2];
if (!file) {
  console.error("Usage: bun run prisma/apply-sql.mjs <file.sql>");
  process.exit(1);
}

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "../.env");
const line = readFileSync(envPath, "utf8").split("\n").find((l) => l.trim().startsWith("DATABASE_URL="));
const url = line?.trim().replace("DATABASE_URL=", "").replace(/^"|"$/g, "").trim();
if (!url) {
  console.error("DATABASE_URL not found in", envPath);
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(readFileSync(resolve(file), "utf8"));
  console.log("Applied", file);
} finally {
  await client.end();
}
