import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../services/auth.service.ts";
import prisma from "../config/prisma.ts";
import { ApiError } from "../utils/apiError.ts";

/**
 * JWT authentication middleware.
 * Verifies the access token, loads the user from DB, and attaches
 * a typed `req.user` object for downstream handlers.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ApiError("Missing or malformed Authorization header", 401);
    }

    const token = authHeader.slice(7);
    if (!token) {
      throw new ApiError("Missing access token", 401);
    }

    const { payload } = await verifyAccessToken(token);

    const userId = payload.sub;
    if (!userId) {
      throw new ApiError("Invalid token: missing subject", 401);
    }

    // Always load user from DB — role may have changed
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        profileImage: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new ApiError("User no longer exists", 401);
    }

    req.user = user;
    next();
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      next(err);
      return;
    }
    // jose throws specific error types
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code: string }).code;
      if (code === "ERR_JWT_EXPIRED") {
        next(new ApiError("Access token expired", 401));
        return;
      }
      if (code.startsWith("ERR_JWT") || code.startsWith("ERR_JWS")) {
        next(new ApiError("Invalid access token", 401));
        return;
      }
    }
    next(new ApiError("Authentication failed", 401));
  }
}
