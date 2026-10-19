import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/authenticate.ts";
import { requireRole } from "../middleware/require-role.ts";
import { uploadResumeMiddleware } from "../middleware/upload.ts";
import { ApiError } from "../utils/apiError.ts";
import { param, issuesMessage } from "../utils/params.ts";
import * as studentService from "../services/student.service.ts";
import * as resumeService from "../services/resume.service.ts";
import * as skillService from "../services/skill.service.ts";
import * as projectService from "../services/project.service.ts";
import * as jobService from "../services/job.service.ts";
import * as matchService from "../services/match.service.ts";
import * as resumeBuilderService from "../services/resumeBuilder.service.ts";
import {
  updateProfileSchema,
  addSkillSchema,
  createProjectSchema,
  updateProjectSchema,
} from "../validators/student.validator.ts";

const router = Router();

// All student routes require authentication and STUDENT role
router.use(authenticate, requireRole("STUDENT"));

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
router.get("/me/profile", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await studentService.getStudentProfile(req.user!.id);
    res.status(200).json({ error: false, data: profile });
  } catch (err) {
    next(err);
  }
});

router.put("/me/profile", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = issuesMessage(parsed.error);
      throw new ApiError(message, 400);
    }
    const profile = await studentService.updateStudentProfile(req.user!.id, parsed.data);
    res.status(200).json({ error: false, message: "Profile updated successfully", data: profile });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Resume Upload & Management (LLM extraction via memory buffer, no raw file DB storage)
// ---------------------------------------------------------------------------
export { getParsedResume } from "../services/resume.service.ts";

const handleResumeUpload = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await resumeService.saveResume(req.user!.id, req.file);
    res.status(201).json({
      error: false,
      data: result,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};

router.post("/me/resume", uploadResumeMiddleware.single("resume"), handleResumeUpload);


router.get("/me/resumes", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resumes = await resumeService.listResumes(req.user!.id);
    res.status(200).json({ error: false, data: resumes });
  } catch (err) {
    next(err);
  }
});

const handleGetResumeById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resume = await resumeService.getResumeById(req.user!.id, param(req, "id"), req.user!.role);
    res.status(200).json({ error: false, data: resume });
  } catch (err) {
    next(err);
  }
};

router.get("/me/resumes/:id", handleGetResumeById);

// Every claim in an uploaded resume checked against the student's evidence (flags what is not backed yet)
router.get("/me/resumes/:id/claim-check", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await resumeBuilderService.claimCheckForResume(req.user!.id, param(req, "id"));
    res.status(200).json({ error: false, data: result });
  } catch (err) {
    next(err);
  }
});

router.get("/me/recommendations", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await matchService.recommendationsFor(req.user!.id, 10);
    res.status(200).json({ error: false, data });
  } catch (err) {
    next(err);
  }
});
router.get("/resumes/:id", handleGetResumeById);

router.delete("/me/resumes/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await resumeService.deleteResume(req.user!.id, param(req, "id"));
    res.status(200).json({ error: false, ...result });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------
router.get("/me/skills", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resumeId = req.query.resumeId as string | undefined;
    const skills = await skillService.getStudentSkills(req.user!.id, resumeId);
    res.status(200).json({ error: false, data: skills });
  } catch (err) {
    next(err);
  }
});

router.post("/me/skills", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = addSkillSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = issuesMessage(parsed.error);
      throw new ApiError(message, 400);
    }
    const skill = await skillService.addStudentSkill(req.user!.id, parsed.data);
    res.status(201).json({ error: false, message: "Skill added successfully", data: skill });
  } catch (err) {
    next(err);
  }
});

router.delete("/me/skills/:skillId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await skillService.removeStudentSkill(req.user!.id, param(req, "skillId"));
    res.status(200).json({ error: false, ...result });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
router.get("/me/projects", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projects = await projectService.listProjects(req.user!.id);
    res.status(200).json({ error: false, data: projects });
  } catch (err) {
    next(err);
  }
});

router.post("/me/projects", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = issuesMessage(parsed.error);
      throw new ApiError(message, 400);
    }
    const project = await projectService.createProject(req.user!.id, parsed.data);
    res.status(201).json({ error: false, message: "Project created successfully", data: project });
  } catch (err) {
    next(err);
  }
});

router.get("/me/projects/:projectId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await projectService.getProject(req.user!.id, param(req, "projectId"));
    res.status(200).json({ error: false, data: project });
  } catch (err) {
    next(err);
  }
});

router.patch("/me/projects/:projectId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = issuesMessage(parsed.error);
      throw new ApiError(message, 400);
    }
    const project = await projectService.updateProject(req.user!.id, param(req, "projectId"), parsed.data);
    res.status(200).json({ error: false, message: "Project updated successfully", data: project });
  } catch (err) {
    next(err);
  }
});

router.delete("/me/projects/:projectId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await projectService.deleteProject(req.user!.id, param(req, "projectId"));
    res.status(200).json({ error: false, ...result });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------
router.get("/me/applications", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const applications = await jobService.getStudentApplications(req.user!.id);
    res.status(200).json({ error: false, data: applications });
  } catch (err) {
    next(err);
  }
});

router.get("/me/applications/:applicationId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const app = await jobService.getStudentApplication(req.user!.id, param(req, "applicationId"));
    res.status(200).json({ error: false, data: app });
  } catch (err) {
    next(err);
  }
});

router.post("/me/applications/:applicationId/withdraw", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await jobService.withdrawApplication(req.user!.id, param(req, "applicationId"));
    res.status(200).json({ error: false, message: "Application withdrawn successfully", data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
