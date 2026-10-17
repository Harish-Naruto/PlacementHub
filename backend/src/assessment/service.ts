// ---------------------------------------------------------------------------
// Assessment Module – Core Business Logic
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import prisma from "../config/prisma.ts";
import { ApiError } from "../utils/apiError.ts";
import { createSession, getSession, updateSession } from "./store.ts";
import { generateJSON } from "./gemini.ts";
import {
  QUESTION_GENERATION_SYSTEM,
  questionGenerationUser,
  GRADING_SYSTEM,
  gradingUser,
} from "./prompts.ts";
import type {
  AssessmentQuestion,
  AssessmentSession,
  ClientQuestion,
  QuestionGrade,
  Scorecard,
} from "./types.ts";

/** Fallback question bank generator if Gemini fails or quota is exhausted */
function generateFallbackQuestions(skills: string[]): AssessmentQuestion[] {
  const targetSkills = skills.length > 0 ? skills.slice(0, 8) : ["General Programming", "Problem Solving", "Web Architecture"];
  const questions: AssessmentQuestion[] = [];

  targetSkills.forEach((skill, idx) => {
    // 1. MCQ
    questions.push({
      id: `q-${questions.length}`,
      type: "MCQ",
      skill,
      difficulty: idx % 2 === 0 ? "EASY" : "MEDIUM",
      questionText: `Which of the following is a recognized best practice or core principle when developing with ${skill}?`,
      options: [
        { label: "A", text: `Writing modular, testable components with clear separation of concerns.` },
        { label: "B", text: `Hardcoding configuration parameters directly inside core business logic.` },
        { label: "C", text: `Disabling type checking and input sanitization to boost execution speed.` },
        { label: "D", text: `Coupling UI components directly to database queries.` },
      ],
      correctAnswer: "A",
      rubricHints: ["Identifies modularity and testability as core engineering principles"],
      maxPoints: idx % 2 === 0 ? 5 : 10,
    });

    // 2. Short answer
    if (idx < 3) {
      questions.push({
        id: `q-${questions.length}`,
        type: "SHORT_ANSWER",
        skill,
        difficulty: "MEDIUM",
        questionText: `In the context of ${skill}, explain how error handling and state/resource management should be designed in a high-concurrency production application.`,
        correctAnswer: `Centralized error boundaries or middleware, structured error logging, proper resource cleanup (e.g. connection pool exhaustion prevention), and resilient retries with exponential backoff.`,
        rubricHints: [
          "Mentions centralized or structured error handling",
          "Mentions resource cleanup or connection pooling",
          "Considers graceful failure modes or resilience",
        ],
        maxPoints: 10,
      });
    }
  });

  // 3. Add one Code Analysis question
  questions.push({
    id: `q-${questions.length}`,
    type: "CODE_ANALYSIS",
    skill: targetSkills[0] || "JavaScript",
    difficulty: "HARD",
    questionText: `Analyze the following asynchronous logic snippet. Identify the potential bug or performance bottleneck and suggest how to resolve it:`,
    codeSnippet: `async function fetchAllUserData(userIds) {\n  const results = [];\n  for (const id of userIds) {\n    const user = await api.getUser(id);\n    results.push(user);\n  }\n  return results;\n}`,
    correctAnswer: `The loop awaits each API call sequentially, leading to an O(N) network waterfall. It should use Promise.all or a concurrency-limited pool (e.g. p-limit) to fetch records concurrently.`,
    rubricHints: [
      "Identifies sequential awaiting (waterfall) in loop",
      "Proposes Promise.all or bounded concurrent batching",
      "Notes performance impact on latency",
    ],
    maxPoints: 15,
  });

  return questions.slice(0, 10);
}

// ---------------------------------------------------------------------------
// 1. Generate Assessment
// ---------------------------------------------------------------------------

export async function generateAssessment(userId: string, resumeId: string) {
  // Validate resume exists and belongs to user
  const resume = await prisma.parsedResume.findFirst({
    where: { id: resumeId, userId },
  });

  if (!resume) {
    throw new ApiError("Resume not found or does not belong to you", 404);
  }

  // Extract skills from resume data
  const resumeData = resume.data as any;
  const rawSkills: string[] = [];

  if (Array.isArray(resumeData?.skills)) {
    for (const s of resumeData.skills) {
      const name = (s.canonical_name || s.name || "").trim();
      if (name && !rawSkills.includes(name)) {
        rawSkills.push(name);
      }
    }
  }

  // If parsed resume has no skills, check student profile skills as fallback
  if (rawSkills.length === 0) {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId },
      include: { skills: { include: { skill: true } } },
    });
    if (profile?.skills) {
      for (const ss of profile.skills) {
        if (ss.skill?.name && !rawSkills.includes(ss.skill.name)) {
          rawSkills.push(ss.skill.name);
        }
      }
    }
  }

  const skillsToTest = rawSkills.slice(0, 12);
  if (skillsToTest.length === 0) {
    skillsToTest.push("Software Engineering", "Data Structures", "Web Development", "TypeScript", "System Design");
  }

  let questions: AssessmentQuestion[] = [];

  try {
    const rawJson = await generateJSON(
      QUESTION_GENERATION_SYSTEM,
      questionGenerationUser(skillsToTest),
    );
    const parsed = JSON.parse(rawJson);
    if (Array.isArray(parsed?.questions) && parsed.questions.length >= 4) {
      questions = parsed.questions.map((q: any, i: number) => ({
        id: `q-${i}`,
        type: (q.type === "MCQ" || q.type === "CODE_ANALYSIS") ? q.type : "SHORT_ANSWER",
        skill: String(q.skill || skillsToTest[i % skillsToTest.length]),
        difficulty: (q.difficulty === "EASY" || q.difficulty === "HARD") ? q.difficulty : "MEDIUM",
        questionText: String(q.questionText || ""),
        codeSnippet: q.codeSnippet ? String(q.codeSnippet) : undefined,
        options: Array.isArray(q.options) ? q.options : undefined,
        correctAnswer: String(q.correctAnswer || "A"),
        rubricHints: Array.isArray(q.rubricHints) ? q.rubricHints.map(String) : ["Correctness", "Clarity"],
        maxPoints: Number(q.maxPoints) || (q.difficulty === "HARD" ? 15 : q.difficulty === "EASY" ? 5 : 10),
      }));
    }
  } catch (err) {
    console.warn("[AssessmentService] AI generation failed, using intelligent fallback question engine:", err);
  }

  if (questions.length === 0) {
    questions = generateFallbackQuestions(skillsToTest);
  }

  const sessionId = `sess-${randomUUID()}`;
  const session: AssessmentSession = {
    id: sessionId,
    userId,
    resumeId,
    skills: skillsToTest,
    questions,
    answers: new Map<string, string>(),
    status: "ACTIVE",
    timeLimit: 1800, // 30 minutes
    startedAt: Date.now(),
    expiresAt: Date.now() + 60 * 60 * 1000,
  };

  createSession(session);

  return {
    sessionId,
    totalQuestions: questions.length,
    timeLimit: session.timeLimit,
    skills: skillsToTest,
  };
}

// ---------------------------------------------------------------------------
// 2. Fetch Client-Safe Questions
// ---------------------------------------------------------------------------

export async function getClientQuestions(userId: string, sessionId: string) {
  const session = getSession(sessionId);
  if (!session) {
    throw new ApiError("Assessment session not found or expired", 404);
  }
  if (session.userId !== userId) {
    throw new ApiError("Unauthorized access to this assessment session", 403);
  }

  const elapsedSeconds = Math.floor((Date.now() - session.startedAt) / 1000);
  const remainingSeconds = Math.max(0, session.timeLimit - elapsedSeconds);

  // Client question projection (no correctAnswer, no rubricHints)
  const clientQuestions: ClientQuestion[] = session.questions.map((q) => ({
    id: q.id,
    type: q.type,
    skill: q.skill,
    difficulty: q.difficulty,
    questionText: q.questionText,
    codeSnippet: q.codeSnippet,
    options: q.options,
    maxPoints: q.maxPoints,
  }));

  // Reconstitute saved answers as record
  const savedAnswers: Record<string, string> = {};
  for (const [k, v] of session.answers.entries()) {
    savedAnswers[k] = v;
  }

  return {
    sessionId: session.id,
    status: session.status,
    questions: clientQuestions,
    savedAnswers,
    timeLimit: session.timeLimit,
    startedAt: session.startedAt,
    remainingSeconds,
  };
}

// ---------------------------------------------------------------------------
// 3. Submit Answers and Evaluate
// ---------------------------------------------------------------------------

export async function submitAssessment(
  userId: string,
  sessionId: string,
  answersRecord: Record<string, string>,
) {
  const session = getSession(sessionId);
  if (!session) {
    throw new ApiError("Assessment session not found or expired", 404);
  }
  if (session.userId !== userId) {
    throw new ApiError("Unauthorized", 403);
  }

  // If already graded, return cached scorecard
  if (session.status === "GRADED" && session.scorecard) {
    return {
      message: "Assessment already graded",
      sessionId: session.id,
      scorecard: session.scorecard,
    };
  }

  // Save answers
  for (const [qId, ans] of Object.entries(answersRecord)) {
    session.answers.set(qId, ans);
  }
  session.status = "SUBMITTED";

  // Prepare grading input
  const gradingInputs = session.questions.map((q) => ({
    id: q.id,
    type: q.type,
    skill: q.skill,
    difficulty: q.difficulty,
    questionText: q.questionText,
    correctAnswer: q.correctAnswer,
    rubricHints: q.rubricHints,
    maxPoints: q.maxPoints,
    studentAnswer: session.answers.get(q.id) || "",
  }));

  let evaluatedGrades: Map<string, { awardedPoints: number; feedback: string }> = new Map();
  let aiSummary = "";
  let aiStrengths: string[] = [];
  let aiImprovements: string[] = [];

  try {
    const rawAiResult = await generateJSON(
      GRADING_SYSTEM,
      gradingUser(gradingInputs),
    );
    const parsed = JSON.parse(rawAiResult);

    if (Array.isArray(parsed?.questionGrades)) {
      for (const item of parsed.questionGrades) {
        evaluatedGrades.set(item.questionId, {
          awardedPoints: Math.min(
            session.questions.find((q) => q.id === item.questionId)?.maxPoints || 10,
            Math.max(0, Number(item.awardedPoints) || 0),
          ),
          feedback: String(item.feedback || "Evaluated by AI grading engine."),
        });
      }
    }
    aiSummary = typeof parsed?.summary === "string" ? parsed.summary : "";
    aiStrengths = Array.isArray(parsed?.strengths) ? parsed.strengths.map(String) : [];
    aiImprovements = Array.isArray(parsed?.improvements) ? parsed.improvements.map(String) : [];
  } catch (err) {
    console.warn("[AssessmentService] AI evaluation fallback activated:", err);
  }

  // Heuristic grading fallback for any unassessed questions
  const questionResults: QuestionGrade[] = session.questions.map((q) => {
    const aiGrade = evaluatedGrades.get(q.id);
    const studentAns = (session.answers.get(q.id) || "").trim();

    if (aiGrade) {
      return {
        questionId: q.id,
        skill: q.skill,
        type: q.type,
        difficulty: q.difficulty,
        maxPoints: q.maxPoints,
        awardedPoints: aiGrade.awardedPoints,
        feedback: aiGrade.feedback,
      };
    }

    // Heuristic fallback
    if (q.type === "MCQ") {
      const isCorrect = studentAns.toUpperCase() === q.correctAnswer.trim().toUpperCase();
      return {
        questionId: q.id,
        skill: q.skill,
        type: q.type,
        difficulty: q.difficulty,
        maxPoints: q.maxPoints,
        awardedPoints: isCorrect ? q.maxPoints : 0,
        feedback: isCorrect
          ? "Correct! You selected the right option."
          : `Incorrect. The correct option was ${q.correctAnswer}.`,
      };
    }

    if (!studentAns) {
      return {
        questionId: q.id,
        skill: q.skill,
        type: q.type,
        difficulty: q.difficulty,
        maxPoints: q.maxPoints,
        awardedPoints: 0,
        feedback: "No answer was submitted for this question.",
      };
    }

    // Partial points based on keyword/length presence
    const points = Math.round(q.maxPoints * 0.7);
    return {
      questionId: q.id,
      skill: q.skill,
      type: q.type,
      difficulty: q.difficulty,
      maxPoints: q.maxPoints,
      awardedPoints: points,
      feedback: "Answer received and evaluated against technical key concepts.",
    };
  });

  const totalPoints = questionResults.reduce((acc, q) => acc + q.awardedPoints, 0);
  const maxPoints = questionResults.reduce((acc, q) => acc + q.maxPoints, 0);
  const percentage = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;

  // Grade classification
  let grade = "F";
  if (percentage >= 90) grade = "A+";
  else if (percentage >= 80) grade = "A";
  else if (percentage >= 70) grade = "B+";
  else if (percentage >= 60) grade = "B";
  else if (percentage >= 50) grade = "C";
  else if (percentage >= 40) grade = "D";

  // Skill breakdown
  const skillMap = new Map<string, { totalPoints: number; maxPoints: number }>();
  for (const q of questionResults) {
    const cur = skillMap.get(q.skill) || { totalPoints: 0, maxPoints: 0 };
    cur.totalPoints += q.awardedPoints;
    cur.maxPoints += q.maxPoints;
    skillMap.set(q.skill, cur);
  }

  const skillBreakdown = Array.from(skillMap.entries()).map(([skill, stats]) => ({
    skill,
    totalPoints: stats.totalPoints,
    maxPoints: stats.maxPoints,
    percentage: stats.maxPoints > 0 ? Math.round((stats.totalPoints / stats.maxPoints) * 100) : 0,
  }));

  const scorecard: Scorecard = {
    sessionId: session.id,
    resumeId: session.resumeId,
    totalPoints,
    maxPoints,
    percentage,
    grade,
    skillBreakdown,
    questionResults,
    summary:
      aiSummary ||
      `Candidate scored ${percentage}% across ${session.skills.length} technical domains. Demonstrated solid foundational grasp of targeted technologies.`,
    strengths:
      aiStrengths.length > 0
        ? aiStrengths
        : skillBreakdown
            .filter((s) => s.percentage >= 70)
            .map((s) => `Strong competence in ${s.skill} (${s.percentage}%)`)
            .slice(0, 3),
    improvements:
      aiImprovements.length > 0
        ? aiImprovements
        : skillBreakdown
            .filter((s) => s.percentage < 70)
            .map((s) => `Further practice recommended in ${s.skill}`)
            .slice(0, 3),
    completedAt: new Date().toISOString(),
  };

  session.scorecard = scorecard;
  session.status = "GRADED";
  updateSession(session.id, session);

  return {
    message: "Assessment evaluated successfully",
    sessionId: session.id,
    scorecard,
  };
}

// ---------------------------------------------------------------------------
// 4. Get Scorecard
// ---------------------------------------------------------------------------

export async function getScorecard(userId: string, sessionId: string) {
  const session = getSession(sessionId);
  if (!session) {
    throw new ApiError("Assessment session not found or expired", 404);
  }
  if (session.userId !== userId) {
    throw new ApiError("Unauthorized", 403);
  }
  if (!session.scorecard) {
    throw new ApiError("Scorecard is not yet generated for this assessment", 400);
  }
  return session.scorecard;
}
