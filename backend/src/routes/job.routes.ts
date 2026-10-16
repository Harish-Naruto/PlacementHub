import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/authenticate.ts";
import { requireRole } from "../middleware/require-role.ts";
import { ApiError } from "../utils/apiError.ts";
import * as jobService from "../services/job.service.ts";
import { jobListQuerySchema, applyJobSchema } from "../validators/student.validator.ts";

const router = Router();

// Optional authentication helper: authenticates if Bearer token is provided,
// but allows public unauthenticated browsing of the job board.
const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    return authenticate(req, res, next);
  }
  next();
};

// ---------------------------------------------------------------------------
// Browse published jobs (authenticated or public)
// ---------------------------------------------------------------------------
router.get("/", optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = jobListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(", ");
      throw new ApiError(message, 400);
    }
    const result = await jobService.listJobs(parsed.data);
    res.status(200).json({
      error: false,
      data: result.jobs,
      jobs: result.jobs,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// View job details and eligibility
// ---------------------------------------------------------------------------
router.get("/:jobId", optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await jobService.getJobDetails(req.params.jobId, req.user?.id);
    res.status(200).json({ error: false, data: result });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Apply for a job (student role required)
// ---------------------------------------------------------------------------
router.post(
  "/:jobId/applications",
  authenticate,
  requireRole("STUDENT"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = applyJobSchema.safeParse(req.body);
      if (!parsed.success) {
        const message = parsed.error.errors.map((e) => e.message).join(", ");
        throw new ApiError(message, 400);
      }
      const application = await jobService.applyJob(req.params.jobId, req.user!.id, parsed.data);
      res.status(201).json({
        error: false,
        message: "Applied successfully",
        data: application,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
