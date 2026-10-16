import dotenv from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: optionalInt("PORT", 4000),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",

  // CORS
  allowed_origins: process.env.FRONTEND_URL || "http://localhost:5173",

  // Rate limiting
  rate_limit_window_minutes: () => optionalInt("RATE_LIMIT_WINDOW_MINUTES", 15),
  rate_limit_max_request: () => optionalInt("RATE_LIMIT_MAX_REQUESTS", 100),

  // Resume parsing (Gemini)
  geminiApiKey: () => required("GEMINI_API_KEY"),
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  resumeMaxBytes: 5 * 1024 * 1024,

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

  // Computed helpers
  isProduction: () => (process.env.NODE_ENV || "development") === "production",
} as const;

export default config;
