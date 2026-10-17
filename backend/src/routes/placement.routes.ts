import { Router } from "express";
import type { Request, Response } from "express";
import { authenticate } from "../middleware/authenticate.ts";
import { requireRole } from "../middleware/require-role.ts";
import { param, validate } from "../utils/params.ts";
import * as ingestService from "../services/ingest.service.ts";
import * as placementService from "../services/placement.service.ts";
import * as jobAdminService from "../services/jobAdmin.service.ts";
import * as pipelineService from "../services/pipeline.service.ts";
import {
  boardQuerySchema,
  ingestApiSchema,
  ingestPasteSchema,
  jobPatchSchema,
  rankFilterSchema,
  rankRequestSchema,
  statusChangeSchema,
} from "../validators/portal.validator.ts";

// The placement team: ingest openings, review them, rank a batch, move applications along the pipeline.
// Express 5 forwards a rejected async handler to the error handler, so no try/catch is needed here.
const router = Router();
router.use(authenticate, requireRole("PLACEMENT"));

const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ error: false, data });

// ---- ingestion ------------------------------------------------------------------------------------

router.post("/ingest/paste", async (req: Request, res: Response) => {
  const body = validate(ingestPasteSchema, req.body);
  const result = await ingestService.ingestJob({
    text: body.text,
    userId: req.user!.id,
    hints: { company: body.company, title: body.title, location: body.location },
    source: { sourceType: body.sourceType, sourceLabel: body.sourceLabel ?? null, sourceUrl: body.sourceUrl ?? null },
  });
  ok(res, result, result.created ? 201 : 200);
});

router.post("/ingest/api", async (req: Request, res: Response) => {
  const { adapter } = validate(ingestApiSchema, req.body ?? {});
  ok(res, await ingestService.ingestFromApi(adapter, req.user!.id));
});

// ---- openings -------------------------------------------------------------------------------------

router.get("/jobs", async (req: Request, res: Response) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  ok(res, await placementService.listJobsForPlacement({ status, search }));
});

router.get("/jobs/:jobId", async (req: Request, res: Response) => {
  ok(res, await placementService.getJobForPlacement(param(req, "jobId")));
});

router.patch("/jobs/:jobId", async (req: Request, res: Response) => {
  const patch = validate(jobPatchSchema, req.body);
  ok(res, await jobAdminService.updateJobDetails(param(req, "jobId"), patch));
});

for (const [path, status] of [["publish", "PUBLISHED"], ["pause", "PAUSED"], ["close", "CLOSED"]] as const) {
  router.post(`/jobs/:jobId/${path}`, async (req: Request, res: Response) => {
    ok(res, await jobAdminService.setJobStatus(param(req, "jobId"), status));
  });
}

// ---- batch ranking --------------------------------------------------------------------------------

router.post("/rank", async (req: Request, res: Response) => {
  const body = validate(rankRequestSchema, req.body);
  ok(res, await placementService.rankBatch(body));
});

// ---- pipeline -------------------------------------------------------------------------------------

router.get("/applications", async (req: Request, res: Response) => {
  ok(res, await pipelineService.listApplications(validate(boardQuerySchema, req.query)));
});

router.get("/applications/:applicationId", async (req: Request, res: Response) => {
  ok(res, await pipelineService.getApplicationDetail(param(req, "applicationId")));
});

router.patch("/applications/:applicationId/status", async (req: Request, res: Response) => {
  const body = validate(statusChangeSchema, req.body);
  ok(res, await pipelineService.changeApplicationStatus({ applicationId: param(req, "applicationId"), actorUserId: req.user!.id, to: body.status, note: body.note }));
});

// ---- students and dashboard -----------------------------------------------------------------------

router.get("/students", async (req: Request, res: Response) => {
  ok(res, await placementService.listStudentsForPlacement(validate(rankFilterSchema, req.query)));
});

router.get("/stats", async (_req: Request, res: Response) => {
  ok(res, await placementService.placementStats());
});

export default router;
