/**
 * Applies one or more SQL files, in the order given, to the database in backend/.env (DATABASE_URL).
 *   bun run prisma/apply-sql.mjs prisma/migrations/<a>/migration.sql prisma/migrations/<b>/migration.sql
 * Each file is sent as one batch (a single transaction), so a file that fails changes nothing.
 * The files must be idempotent (IF NOT EXISTS); the two newest migrations are.
 */
import pg from "pg";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: bun run prisma/apply-sql.mjs <file.sql> [more.sql ...]");
  process.exit(1);
}

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "../.env");
const line = readFileSync(envPath, "utf8").split("\n").find((l) => l.trim().startsWith("DATABASE_URL="));
const url = line?.trim().replace("DATABASE_URL=", "").replace(/^"|"$/g, "").trim();
if (!url) {
  console.error("DATABASE_URL not found in", envPath);
  process.exit(1);
}

console.log("Database host:", new URL(url).host);
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
await client.connect();
try {
  for (const file of files) {
    await client.query(readFileSync(resolve(file), "utf8"));
    console.log("Applied", file);
  }
} finally {
  await client.end();
}
