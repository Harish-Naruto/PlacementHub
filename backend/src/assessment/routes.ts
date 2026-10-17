// ---------------------------------------------------------------------------
// Assessment Module – Express Routes
// ---------------------------------------------------------------------------

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import prisma from "../config/prisma.ts";
import { extractClaims } from "../github/claims.ts";
import { verifyGithub } from "../github/verify.ts";
import { authenticate } from "../middleware/authenticate.ts";
import type { ParsedResume } from "../resume/schema.ts";
import { ApiError } from "../utils/apiError.ts";
import {
  generateAssessment,
  getClientQuestions,
  submitAssessment,
  getScorecard,
} from "./service.ts";
import type { PersistenceSummary } from "../scoring/skillPersistence.ts";
import { persistSkillVerification } from "../services/skillEvidence.service.ts";
import { buildSkillScores, getGradedSession, type SkillScoresResponse } from "./skillScores.ts";

const router = Router();

// All assessment routes require student authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// POST /api/v1/assessments/generate
// ---------------------------------------------------------------------------
router.post("/generate", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { resumeId } = req.body;

    if (!resumeId || typeof resumeId !== "string") {
      throw new ApiError("Missing required parameter: resumeId", 400);
    }

    const t0 = Date.now();
    const result = await generateAssessment(userId, resumeId);
    console.info(`[Timing] assessment generated in ${Date.now() - t0}ms`);
    res.status(201).json({
      error: false,
      message: "Assessment generated successfully",
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/assessments/:sessionId/questions
// ---------------------------------------------------------------------------
router.get("/:sessionId/questions", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { sessionId } = req.params;

    if (!sessionId) {
      throw new ApiError("Session ID required", 400);
    }

    const result = await getClientQuestions(userId, sessionId);
    res.status(200).json({
      error: false,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/assessments/:sessionId/submit
// ---------------------------------------------------------------------------
router.post("/:sessionId/submit", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { sessionId } = req.params;
    const { answers } = req.body;

    if (!sessionId) {
      throw new ApiError("Session ID required", 400);
    }

    const answersRecord = (answers && typeof answers === "object") ? answers : {};
    const t0 = Date.now();
    const result = await submitAssessment(userId, sessionId, answersRecord);
    console.info(`[Timing] assessment graded in ${Date.now() - t0}ms`);

    // Record the assessment proof on the student's skills in the background: the student already has
    // their scorecard, so the response must not wait for these database writes (and they never fail it).
    void saveVerificationEvidence(userId, sessionId);

    res.status(200).json({
      error: false,
      message: result.message,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/assessments/:sessionId/scorecard
// ---------------------------------------------------------------------------
router.get("/:sessionId/scorecard", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { sessionId } = req.params;

    if (!sessionId) {
      throw new ApiError("Session ID required", 400);
    }

    const scorecard = await getScorecard(userId, sessionId);
    res.status(200).json({
      error: false,
      data: scorecard,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/assessments/:sessionId/skill-scores
// Per-skill assessment + GitHub evidence + combined scores. Makes no GitHub
// requests: uses the last verification stored on the session, if any.
// ---------------------------------------------------------------------------
// Every skill listed on the resume, so none escapes verification. A missing or unreadable resume
// just means the verdicts cover the assessed skills only.
async function loadResume(userId: string, resumeId: string): Promise<ParsedResume | null> {
  try {
    const row = await prisma.parsedResume.findFirst({ where: { id: resumeId, userId } });
    return row ? (row.data as unknown as ParsedResume) : null;
  } catch {
    return null;
  }
}

const resumeSkillsOf = (resume: ParsedResume | null) =>
  resume ? extractClaims(resume).skills.map((s) => ({ name: s.name, references: s.references })) : [];

type Persistence = PersistenceSummary | { error: string };

/** Writes scored skills to StudentSkill + SkillEvidence. Logs only the error type; never throws. */
async function persistSafely(userId: string, scores: SkillScoresResponse): Promise<Persistence> {
  const started = Date.now();
  try {
    const summary = await persistSkillVerification(userId, scores.sessionId, scores.skills);
    console.info(`[SkillEvidence] saved ${summary.skills} skills (${summary.failed} failed) in ${Date.now() - started}ms`);
    return summary;
  } catch (err) {
    console.error("[SkillEvidence] could not save skill verification:", (err as Error)?.name);
    return { error: "Could not save skill verification to your profile" };
  }
}

/** After grading: persist the assessment-only scores (idempotent, so a repeated submit is harmless). */
async function saveVerificationEvidence(userId: string, sessionId: string): Promise<void> {
  try {
    const session = getGradedSession(userId, sessionId);
    const resume = await loadResume(userId, session.resumeId);
    await persistSafely(userId, await buildSkillScores(session, undefined, resumeSkillsOf(resume)));
  } catch (err) {
    console.error("[SkillEvidence] post-grading save skipped:", (err as Error)?.name);
  }
}

router.get("/:sessionId/skill-scores", async (req, res, next) => {
  try {
    const session = getGradedSession(req.user!.id, req.params.sessionId as string);
    const resume = await loadResume(session.userId, session.resumeId);
    res.status(200).json({ error: false, data: await buildSkillScores(session, undefined, resumeSkillsOf(resume)) });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/assessments/:sessionId/skill-scores
// Body (optional): { "githubUsername": "octocat" | "https://github.com/octocat" }
// Explicitly runs GitHub verification, then returns the combined scores. A GitHub
// failure still returns 200 with assessment-only scores and github.state = "failed".
// ---------------------------------------------------------------------------
const githubLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? "anonymous",
  validate: { keyGeneratorIpFallback: false },
  message: { error: true, message: "Too many GitHub verifications; please wait and try again", code: "RATE_LIMITED" },
});

const skillScoresBody = z.object({ githubUsername: z.string().trim().min(1).max(200).optional() });

router.post("/:sessionId/skill-scores", githubLimiter, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const body = skillScoresBody.safeParse(req.body ?? {});
    if (!body.success) throw new ApiError("Invalid request body", 400, true, "INVALID_BODY");

    const session = getGradedSession(userId, req.params.sessionId as string);

    const resume = await loadResume(userId, session.resumeId);

    const run = async () => {
      if (!resume) throw new ApiError("Resume not found", 404, true, "NOT_FOUND");
      const profile = await prisma.studentProfile.findUnique({ where: { userId }, select: { githubUsername: true } });
      return verifyGithub({
        resume,
        username: body.data.githubUsername,
        profileUsername: profile?.githubUsername,
      });
    };

    const scores = await buildSkillScores(session, run, resumeSkillsOf(resume));
    // Save to the student's skill profile (StudentSkill status + SkillEvidence proof rows).
    const persistence = await persistSafely(userId, scores);
    res.status(200).json({ error: false, data: { ...scores, persistence } });
  } catch (err) {
    next(err);
  }
});

export default router;
