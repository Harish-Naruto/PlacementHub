import { randomBytes, createHash } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { SignJWT, jwtVerify } from "jose";
import config from "../config/index.ts";
import prisma from "../config/prisma.ts";
import { ApiError } from "../utils/apiError.ts";
import type { RegisterInput, LoginInput } from "../validators/auth.validator.ts";
import type { UserRole } from "../../generated/prisma/client.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

const jwtSecretKey = new TextEncoder().encode(config.jwtAccessSecret);

// ---------------------------------------------------------------------------
// Public user shape (never includes passwordHash)
// ---------------------------------------------------------------------------

export interface SafeUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  profileImage: string | null;
  createdAt: Date;
}

function toSafeUser(user: {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  profileImage: string | null;
  createdAt: Date;
}): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    profileImage: user.profileImage,
    createdAt: user.createdAt,
  };
}

// ---------------------------------------------------------------------------
// JWT
// ---------------------------------------------------------------------------

async function signAccessToken(userId: string, role: UserRole): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(config.jwtIssuer)
    .setAudience(config.jwtAudience)
    .setIssuedAt()
    .setExpirationTime(config.jwtAccessTtl)
    .sign(jwtSecretKey);
}

export async function verifyAccessToken(token: string) {
  return jwtVerify(token, jwtSecretKey, {
    algorithms: ["HS256"],
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
    requiredClaims: ["sub"],
  });
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

async function createSession(userId: string) {
  const rawToken = generateRefreshToken();
  const tokenHashValue = hashToken(rawToken);
  const familyId = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  );

  await prisma.authSession.create({
    data: {
      userId,
      tokenHash: tokenHashValue,
      tokenFamily: familyId,
      expiresAt,
    },
  });

  return { rawToken, expiresAt };
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export async function register(input: RegisterInput) {
  const { email, name, password, role: inputRole, invitationCode } = input;

  // Determine role from input (defaults to STUDENT if omitted)
  let role: UserRole = inputRole || "STUDENT";
  if (invitationCode) {
    if (invitationCode !== config.recruiterSignupCode) {
      throw new ApiError("Invalid invitation code", 403);
    }
    role = "RECRUITER";
  }

  // Check for existing email
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError("An account with this email already exists", 409);
  }

  // Hash password with Argon2id
  const passwordHash = await hash(password, {
    algorithm: 2, // argon2id
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role,
    },
  });

  // Create session
  const { rawToken, expiresAt } = await createSession(user.id);

  // Sign JWT
  const accessToken = await signAccessToken(user.id, user.role);

  return {
    user: toSafeUser(user),
    accessToken,
    refreshToken: rawToken,
    refreshExpiresAt: expiresAt,
  };
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function login(input: LoginInput) {
  const { email, password, role } = input;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new ApiError("Invalid email or password", 401);
  }

  // Explicitly check role: student cannot log in as recruiter or vice versa
  if (role && user.role !== role) {
    throw new ApiError(
      `Access denied: This account is registered as ${user.role}, not ${role}`,
      403,
    );
  }

  const valid = await verify(user.passwordHash, password);
  if (!valid) {
    throw new ApiError("Invalid email or password", 401);
  }

  const { rawToken, expiresAt } = await createSession(user.id);
  const accessToken = await signAccessToken(user.id, user.role);

  return {
    user: toSafeUser(user),
    accessToken,
    refreshToken: rawToken,
    refreshExpiresAt: expiresAt,
  };
}

// ---------------------------------------------------------------------------
// Refresh
// ---------------------------------------------------------------------------

export async function refresh(rawRefreshToken: string) {
  const tokenHashValue = hashToken(rawRefreshToken);

  // Look up the session with its user
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: tokenHashValue },
    include: { user: true },
  });

  if (!session) {
    throw new ApiError("Invalid refresh token", 401);
  }

  // Revoked — possible token reuse attack; revoke entire family
  if (session.revokedAt) {
    await prisma.authSession.updateMany({
      where: { tokenFamily: session.tokenFamily, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new ApiError(
      "Refresh token reuse detected — all sessions in this family revoked",
      401,
    );
  }

  if (session.expiresAt < new Date()) {
    throw new ApiError("Refresh token expired", 401);
  }

  // Revoke old token (fail-closed: even if create below fails, old token is gone)
  await prisma.authSession.update({
    where: { id: session.id },
    data: { revokedAt: new Date(), lastUsedAt: new Date() },
  });

  // Create new rotated token in the same family
  const newRawToken = generateRefreshToken();
  const newTokenHash = hashToken(newRawToken);
  const newExpiresAt = new Date(
    Date.now() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  );

  await prisma.authSession.create({
    data: {
      userId: session.userId,
      tokenHash: newTokenHash,
      tokenFamily: session.tokenFamily,
      expiresAt: newExpiresAt,
    },
  });

  const accessToken = await signAccessToken(session.user.id, session.user.role);

  return {
    user: toSafeUser(session.user),
    accessToken,
    refreshToken: newRawToken,
    refreshExpiresAt: newExpiresAt,
  };
}


// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export async function logout(rawRefreshToken: string) {
  const tokenHashValue = hashToken(rawRefreshToken);

  // Silently succeed even if the token doesn't exist
  await prisma.authSession.updateMany({
    where: { tokenHash: tokenHashValue, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Get current user
// ---------------------------------------------------------------------------

export async function getMe(userId: string): Promise<SafeUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError("User not found", 404);
  }
  return toSafeUser(user);
}
