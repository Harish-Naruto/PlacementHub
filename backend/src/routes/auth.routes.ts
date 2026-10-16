import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import * as authService from "../services/auth.service.ts";
import { registerSchema, loginSchema } from "../validators/auth.validator.ts";
import { authenticate } from "../middleware/authenticate.ts";
import { requireRole } from "../middleware/require-role.ts";
import { ApiError } from "../utils/apiError.ts";
import config from "../config/index.ts";

const router = Router();

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

const REFRESH_COOKIE = "refresh_token";

function setRefreshCookie(
  res: Response,
  token: string,
  expiresAt: Date,
): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.isProduction(),
    sameSite: config.isProduction() ? "strict" : "lax",
    path: "/api/v1/auth",
    expires: expiresAt,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: config.isProduction(),
    sameSite: config.isProduction() ? "strict" : "lax",
    path: "/api/v1/auth",
  });
}

// ---------------------------------------------------------------------------
// POST /auth/register
// ---------------------------------------------------------------------------

router.post(
  "/register",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        const message = parsed.error.issues.map((e) => e.message).join(", ");
        throw new ApiError(message, 400);
      }
      
      const result = await authService.register(parsed.data);
      console.log(result)
      setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);

      res.status(201).json({
        error: false,
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------

router.post(
  "/login",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        const message = parsed.error.issues.map((e) => e.message).join(", ");
        throw new ApiError(message, 400);
      }

      const result = await authService.login(parsed.data);

      setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);

      res.status(200).json({
        error: false,
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /auth/refresh
// ---------------------------------------------------------------------------

router.post(
  "/refresh",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawToken = req.cookies?.[REFRESH_COOKIE];
      if (!rawToken || typeof rawToken !== "string") {
        throw new ApiError("Missing refresh token", 401);
      }

      const result = await authService.refresh(rawToken);

      setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);

      res.status(200).json({
        error: false,
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /auth/logout
// ---------------------------------------------------------------------------

router.post(
  "/logout",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawToken = req.cookies?.[REFRESH_COOKIE];
      if (rawToken && typeof rawToken === "string") {
        await authService.logout(rawToken);
      }

      clearRefreshCookie(res);

      res.status(200).json({
        error: false,
        message: "Logged out",
      });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /auth/me
// ---------------------------------------------------------------------------

router.get(
  "/me",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await authService.getMe(req.user!.id);

      res.status(200).json({
        error: false,
        data: { user },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// Example protected recruiter-only route (for testing)
// ---------------------------------------------------------------------------

router.get(
  "/recruiter-check",
  authenticate,
  requireRole("RECRUITER"),
  (_req: Request, res: Response) => {
    res.status(200).json({
      error: false,
      message: "You have recruiter access",
    });
  },
);

export default router;
