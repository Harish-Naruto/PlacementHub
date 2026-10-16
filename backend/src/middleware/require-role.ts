import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "../../generated/prisma/client.js";
import { ApiError } from "../utils/apiError.ts";

/**
 * Role-based authorization middleware.
 * Must be used AFTER `authenticate` middleware.
 *
 * Usage:
 *   router.get("/admin", authenticate, requireRole("RECRUITER"), handler);
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ApiError("Authentication required", 401));
      return;
    }

    if (!roles.includes(req.user.role as UserRole)) {
      next(new ApiError("Insufficient permissions", 403));
      return;
    }

    next();
  };
}
