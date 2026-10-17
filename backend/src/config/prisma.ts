import pg from "pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import config from "./index.ts";

const connectionString = config.databaseUrl;

try {
  const parsed = new URL(connectionString);
  console.log(`🔌 [Prisma] Connecting to DB host: ${parsed.host} (SSL enabled)`);
} catch {
  // ignore
}

const pool = new pg.Pool({
  connectionString,
  // A local development database has no TLS; hosted databases (Supabase) do.
  ssl: /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString) ? false : { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  console.error("❌ Unexpected error on idle DB client", err.message);
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

export default prisma;
