import { Router } from "express";
import type { Request, Response } from "express";
import { authenticate } from "../middleware/authenticate.ts";
import { requireRole } from "../middleware/require-role.ts";
import { param, validate } from "../utils/params.ts";
import * as portal from "../services/recruiterPortal.service.ts";
import {
  applicantsQuerySchema,
  jobPatchSchema,
  recruiterCreateJobSchema,
  recruiterProfileSchema,
  statusChangeSchema,
} from "../validators/portal.validator.ts";

// Recruiter portal. Every route is scoped to the signed-in recruiter's own company and jobs.
// Express 5 forwards a rejected async handler to the error handler, so no try/catch is needed here.
const router = Router();
router.use(authenticate, requireRole("RECRUITER"));

const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ error: false, data });

router.get("/me", async (req: Request, res: Response) => {
  ok(res, await portal.getProfile(req.user!.id));
});

router.put("/me", async (req: Request, res: Response) => {
  ok(res, await portal.upsertProfile(req.user!.id, validate(recruiterProfileSchema, req.body)));
});

// ---- jobs ------------------------------------------------------------------------------------------

router.get("/jobs", async (req: Request, res: Response) => {
  ok(res, await portal.listJobs(req.user!.id, typeof req.query.status === "string" ? req.query.status : undefined));
});

router.post("/jobs", async (req: Request, res: Response) => {
  ok(res, await portal.createJob(req.user!.id, validate(recruiterCreateJobSchema, req.body)), 201);
});

router.get("/jobs/:jobId", async (req: Request, res: Response) => {
  ok(res, await portal.getJob(req.user!.id, param(req, "jobId")));
});

router.patch("/jobs/:jobId", async (req: Request, res: Response) => {
  ok(res, await portal.updateJob(req.user!.id, param(req, "jobId"), validate(jobPatchSchema, req.body)));
});

for (const [path, status] of [["publish", "PUBLISHED"], ["pause", "PAUSED"], ["close", "CLOSED"]] as const) {
  router.post(`/jobs/:jobId/${path}`, async (req: Request, res: Response) => {
    ok(res, await portal.changeJobStatus(req.user!.id, param(req, "jobId"), status));
  });
}

router.delete("/jobs/:jobId", async (req: Request, res: Response) => {
  ok(res, await portal.removeDraft(req.user!.id, param(req, "jobId")));
});

// ---- applicants ------------------------------------------------------------------------------------

router.get("/jobs/:jobId/applicants", async (req: Request, res: Response) => {
  ok(res, await portal.listApplicants(req.user!.id, param(req, "jobId"), validate(applicantsQuerySchema, req.query)));
});

router.get("/applications/:applicationId", async (req: Request, res: Response) => {
  ok(res, await portal.getApplicant(req.user!.id, param(req, "applicationId")));
});

router.patch("/applications/:applicationId/status", async (req: Request, res: Response) => {
  const body = validate(statusChangeSchema, req.body);
  ok(res, await portal.updateApplicationStatus(req.user!.id, param(req, "applicationId"), body.status, body.note));
});

export default router;
