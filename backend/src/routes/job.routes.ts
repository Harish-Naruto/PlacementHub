import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/authenticate.ts";
import { requireRole } from "../middleware/require-role.ts";
import { ApiError } from "../utils/apiError.ts";
import { param, issuesMessage } from "../utils/params.ts";
import * as jobService from "../services/job.service.ts";
import * as matchService from "../services/match.service.ts";
import * as resumeBuilderService from "../services/resumeBuilder.service.ts";
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
      const message = issuesMessage(parsed.error);
      throw new ApiError(message, 400);
    }
    const result = await jobService.listJobs(parsed.data, req.user?.id);
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
    const result = await jobService.getJobDetails(param(req, "jobId"), req.user?.id);
    res.status(200).json({ error: false, data: result });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Evidence-backed fit of the signed-in student for one opening, with gaps
// ---------------------------------------------------------------------------
router.get("/:jobId/fit", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fit = await matchService.fitForStudent(req.user!.id, param(req, "jobId"));
    res.status(200).json({ error: false, data: fit });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Tailored one-page resume for one opening; every line carries its evidence
// ---------------------------------------------------------------------------
router.post("/:jobId/resume", authenticate, requireRole("STUDENT"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resumeId = typeof req.body?.resumeId === "string" ? req.body.resumeId : undefined;
    const result = await resumeBuilderService.generateResumeForJob(req.user!.id, param(req, "jobId"), resumeId);
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
        const message = issuesMessage(parsed.error);
        throw new ApiError(message, 400);
      }
      const application = await jobService.applyJob(param(req, "jobId"), req.user!.id, parsed.data);
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
