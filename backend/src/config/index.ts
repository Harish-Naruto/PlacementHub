import dotenv from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseOrigins } from "../utils/cors.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env"), override: true });
dotenv.config({ override: true });



// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optionalInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`${name} must be a valid integer`);
  return n;
}

// ---------------------------------------------------------------------------
// JWT
// ---------------------------------------------------------------------------

const jwtAccessSecret = required("JWT_ACCESS_SECRET");
if (jwtAccessSecret.length < 32) {
  throw new Error("JWT_ACCESS_SECRET must be at least 32 characters");
}

const jwtAccessTtl = process.env.JWT_ACCESS_TTL || "15m";
const jwtIssuer = process.env.JWT_ISSUER || "placementhub";
const jwtAudience = process.env.JWT_AUDIENCE || "placementhub";

// ---------------------------------------------------------------------------
// Refresh token
// ---------------------------------------------------------------------------

const refreshTokenTtlDays = optionalInt("REFRESH_TOKEN_TTL_DAYS", 7);

// ---------------------------------------------------------------------------
// Recruiter signup
// ---------------------------------------------------------------------------

const recruiterSignupCode = required("RECRUITER_SIGNUP_CODE");
// Optional: when unset, nobody can register as a placement-team user.
const placementSignupCode = process.env.PLACEMENT_SIGNUP_CODE || undefined;

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: optionalInt("PORT", 4000),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",

  // CORS: FRONTEND_URL may hold several origins separated by commas. A trailing slash is ignored.
  allowedOrigins: parseOrigins(process.env.FRONTEND_URL),

  // Rate limiting
  rate_limit_window_minutes: () => optionalInt("RATE_LIMIT_WINDOW_MINUTES", 15),
  rate_limit_max_request: () => optionalInt("RATE_LIMIT_MAX_REQUESTS", 100),

  // Resume parsing (Gemini)
  geminiApiKey: () => required("GEMINI_API_KEY"),
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  resumeMaxBytes: 5 * 1024 * 1024,

  // GitHub verification (token is optional; use a public-read-only token, server side only)
  githubToken: process.env.GITHUB_TOKEN || undefined,
  githubTimeoutMs: optionalInt("GITHUB_TIMEOUT_MS", 10_000),
  githubMaxRequests: optionalInt("GITHUB_MAX_REQUESTS", 150),
  githubMaxRepos: optionalInt("GITHUB_MAX_REPOS", 6),
  githubMaxFilesPerRepo: optionalInt("GITHUB_MAX_FILES_PER_REPO", 12),
  githubMaxFileBytes: optionalInt("GITHUB_MAX_FILE_BYTES", 100_000),

  // Database
  databaseUrl: required("DATABASE_URL"),

  // JWT
  jwtAccessSecret,
  jwtAccessTtl,
  jwtIssuer,
  jwtAudience,

  // Refresh
  refreshTokenTtlDays,

  // Recruiter
  recruiterSignupCode,
  placementSignupCode,

  // Computed helpers
  isProduction: () => (process.env.NODE_ENV || "development") === "production",
} as const;

export default config;
