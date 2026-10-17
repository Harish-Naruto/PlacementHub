// ---------------------------------------------------------------------------
// Assessment Module – Express Routes
// ---------------------------------------------------------------------------

import { Router } from "express";
import { authenticate } from "../middleware/authenticate.ts";
import { ApiError } from "../utils/apiError.ts";
import {
  generateAssessment,
  getClientQuestions,
  submitAssessment,
  getScorecard,
} from "./service.ts";

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

    const result = await generateAssessment(userId, resumeId);
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
    const result = await submitAssessment(userId, sessionId, answersRecord);

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

export default router;
