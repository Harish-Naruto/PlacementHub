import { Router } from "express";
import type { Request, Response } from "express";
import { authenticate } from "../middleware/authenticate.ts";
import { requireRole } from "../middleware/require-role.ts";
import { ApiError } from "../utils/apiError.ts";
import {
  upsertCompanySchema,
  createJobSchema,
  updateJobSchema,
  updateApplicationStatusSchema,
  paginationSchema,
} from "../validators/recruiter.validator.ts";
import * as recruiterService from "../services/recruiter.service.ts";
import type {
  ApplicationStatus,
  JobStatus,
} from "../../generated/prisma/client.js";

const router = Router();

function formatZodError(error: any): string {
  const issues = error?.issues || error?.errors || [];
  return issues.map((e: any) => e.message).join(", ") || "Validation failed";
}

// All recruiter routes require authentication + RECRUITER role
router.use(authenticate, requireRole("RECRUITER"));

// ---------------------------------------------------------------------------
// GET /recruiters/me/profile
// ---------------------------------------------------------------------------

router.get("/me/profile", async (req: Request, res: Response) => {
  const profile = await recruiterService.getProfile(req.user!.id);

  if (!profile) {
    res.status(200).json({
      error: false,
      data: { profile: null },
      message: "No profile found. Use PUT to create one.",
    });
    return;
  }

  res.status(200).json({ error: false, data: { profile } });
});

// ---------------------------------------------------------------------------
// PUT /recruiters/me/profile
// ---------------------------------------------------------------------------

router.put("/me/profile", async (req: Request, res: Response) => {
  const parsed = upsertCompanySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(formatZodError(parsed.error), 400);
  }

  const result = await recruiterService.upsertProfile(
    req.user!.id,
    parsed.data,
  );

  res.status(200).json({ error: false, data: result });
});

// ---------------------------------------------------------------------------
// GET /recruiters/me/jobs
// ---------------------------------------------------------------------------

router.get("/me/jobs", async (req: Request, res: Response) => {
  const profile = await recruiterService.getRecruiterProfileOrThrow(
    req.user!.id,
  );

  const parsedPagination = paginationSchema.safeParse(req.query);
  if (!parsedPagination.success) {
    throw new ApiError("Invalid pagination parameters", 400);
  }
  const { page, limit } = parsedPagination.data;

  const statusRaw = req.query.status as string | undefined;
  const allowedStatuses: JobStatus[] = ["DRAFT", "PUBLISHED", "PAUSED", "CLOSED"];
  const status =
    statusRaw && allowedStatuses.includes(statusRaw.toUpperCase() as JobStatus)
      ? (statusRaw.toUpperCase() as JobStatus)
      : undefined;

  const result = await recruiterService.listJobs(profile.id, page, limit, status);

  res.status(200).json({ error: false, data: result });
});

// ---------------------------------------------------------------------------
// POST /recruiters/me/jobs
// ---------------------------------------------------------------------------

router.post("/me/jobs", async (req: Request, res: Response) => {
  const profile = await recruiterService.getRecruiterProfileOrThrow(
    req.user!.id,
  );

  const parsed = createJobSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(formatZodError(parsed.error), 400);
  }

  const job = await recruiterService.createJob(profile.id, parsed.data);

  res.status(201).json({ error: false, data: { job } });
});

// ---------------------------------------------------------------------------
// GET /recruiters/me/jobs/:jobId
// ---------------------------------------------------------------------------

router.get("/me/jobs/:jobId", async (req: Request, res: Response) => {
  const profile = await recruiterService.getRecruiterProfileOrThrow(
    req.user!.id,
  );

  const job = await recruiterService.getJob(req.params.jobId, profile.id);

  res.status(200).json({ error: false, data: { job } });
});

// ---------------------------------------------------------------------------
// PATCH /recruiters/me/jobs/:jobId
// ---------------------------------------------------------------------------

router.patch("/me/jobs/:jobId", async (req: Request, res: Response) => {
  const profile = await recruiterService.getRecruiterProfileOrThrow(
    req.user!.id,
  );

  const parsed = updateJobSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(formatZodError(parsed.error), 400);
  }

  const job = await recruiterService.updateJob(
    req.params.jobId,
    profile.id,
    parsed.data,
  );

  res.status(200).json({ error: false, data: { job } });
});

// ---------------------------------------------------------------------------
// POST /recruiters/me/jobs/:jobId/publish
// ---------------------------------------------------------------------------

router.post("/me/jobs/:jobId/publish", async (req: Request, res: Response) => {
  const profile = await recruiterService.getRecruiterProfileOrThrow(
    req.user!.id,
  );

  const job = await recruiterService.publishJob(req.params.jobId, profile.id);

  res.status(200).json({ error: false, data: { job } });
});

// ---------------------------------------------------------------------------
// POST /recruiters/me/jobs/:jobId/close
// ---------------------------------------------------------------------------

router.post("/me/jobs/:jobId/close", async (req: Request, res: Response) => {
  const profile = await recruiterService.getRecruiterProfileOrThrow(
    req.user!.id,
  );

  const job = await recruiterService.closeJob(req.params.jobId, profile.id);

  res.status(200).json({ error: false, data: { job } });
});

// ---------------------------------------------------------------------------
// POST /recruiters/me/jobs/:jobId/pause
// ---------------------------------------------------------------------------

router.post("/me/jobs/:jobId/pause", async (req: Request, res: Response) => {
  const profile = await recruiterService.getRecruiterProfileOrThrow(
    req.user!.id,
  );

  const job = await recruiterService.pauseJob(req.params.jobId, profile.id);

  res.status(200).json({ error: false, data: { job } });
});

// ---------------------------------------------------------------------------
// GET /recruiters/me/jobs/:jobId/applications
// ---------------------------------------------------------------------------

router.get(
  "/me/jobs/:jobId/applications",
  async (req: Request, res: Response) => {
    const profile = await recruiterService.getRecruiterProfileOrThrow(
      req.user!.id,
    );

    const parsedPagination = paginationSchema.safeParse(req.query);
    if (!parsedPagination.success) {
      throw new ApiError("Invalid pagination parameters", 400);
    }
    const { page, limit } = parsedPagination.data;

    const statusRaw = req.query.status as string | undefined;
    const allowedStatuses: ApplicationStatus[] = [
      "APPLIED",
      "IN_REVIEW",
      "SHORTLISTED",
      "INTERVIEW_SCHEDULED",
      "INTERVIEWING",
      "OFFERED",
      "HIRED",
      "REJECTED",
      "WITHDRAWN",
    ];
    const status =
      statusRaw &&
      allowedStatuses.includes(statusRaw.toUpperCase() as ApplicationStatus)
        ? (statusRaw.toUpperCase() as ApplicationStatus)
        : undefined;

    const result = await recruiterService.listJobApplications(
      req.params.jobId,
      profile.id,
      page,
      limit,
      status,
    );

    res.status(200).json({ error: false, data: result });
  },
);

// ---------------------------------------------------------------------------
// GET /recruiters/me/applications/:applicationId
// ---------------------------------------------------------------------------

router.get(
  "/me/applications/:applicationId",
  async (req: Request, res: Response) => {
    const profile = await recruiterService.getRecruiterProfileOrThrow(
      req.user!.id,
    );

    const application = await recruiterService.getApplication(
      req.params.applicationId,
      profile.id,
    );

    res.status(200).json({ error: false, data: { application } });
  },
);

// ---------------------------------------------------------------------------
// PATCH /recruiters/me/applications/:applicationId/status
// ---------------------------------------------------------------------------

router.patch(
  "/me/applications/:applicationId/status",
  async (req: Request, res: Response) => {
    const profile = await recruiterService.getRecruiterProfileOrThrow(
      req.user!.id,
    );

    const parsed = updateApplicationStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(formatZodError(parsed.error), 400);
    }

    const application = await recruiterService.updateApplicationStatus(
      req.params.applicationId,
      profile.id,
      req.user!.id,
      parsed.data,
    );

    res.status(200).json({ error: false, data: { application } });
  },
);

// ---------------------------------------------------------------------------
// GET /recruiters/me/applications/:applicationId/events
// ---------------------------------------------------------------------------

router.get(
  "/me/applications/:applicationId/events",
  async (req: Request, res: Response) => {
    const profile = await recruiterService.getRecruiterProfileOrThrow(
      req.user!.id,
    );

    const events = await recruiterService.getApplicationEvents(
      req.params.applicationId,
      profile.id,
    );

    res.status(200).json({ error: false, data: { events } });
  },
);

export default router;
