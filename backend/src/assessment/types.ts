// ---------------------------------------------------------------------------
// Assessment Module – Type Definitions
// Zero database persistence: everything lives in the in-memory store.
// ---------------------------------------------------------------------------

import type { VerificationReport } from "../github/types.ts";
import type { GithubReportState } from "../scoring/skillScoring.ts";

export type QuestionType = "MCQ" | "SHORT_ANSWER" | "CODE_ANALYSIS";

export interface MCQOption {
  label: string; // "A", "B", "C", "D"
  text: string;
}

/** Full question stored server-side (includes correct answer + rubric). */
export interface AssessmentQuestion {
  id: string;                   // q-{index}
  type: QuestionType;
  skill: string;                // skill name this question targets
  difficulty: "EASY" | "MEDIUM" | "HARD";
  questionText: string;
  codeSnippet?: string;         // only for CODE_ANALYSIS
  options?: MCQOption[];        // only for MCQ
  correctAnswer: string;       // MCQ: "A"–"D", others: model answer
  rubricHints: string[];        // grading rubric for AI evaluator
  maxPoints: number;
}

/** Client-safe question (no correct answer, no rubric). */
export interface ClientQuestion {
  id: string;
  type: QuestionType;
  skill: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  questionText: string;
  codeSnippet?: string;
  options?: MCQOption[];
  maxPoints: number;
}

/** Stored per-question grade from AI evaluator. */
export interface QuestionGrade {
  questionId: string;
  skill: string;
  type: QuestionType;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  maxPoints: number;
  awardedPoints: number;
  feedback: string;
}

/** Complete scorecard returned to the client after evaluation. */
export interface Scorecard {
  sessionId: string;
  resumeId: string;
  totalPoints: number;
  maxPoints: number;
  percentage: number;
  grade: string;              // "A+", "A", "B+", "B", "C", "D", "F"
  skillBreakdown: {
    skill: string;
    totalPoints: number;
    maxPoints: number;
    percentage: number;
  }[];
  questionResults: QuestionGrade[];
  summary: string;            // AI-generated overall summary
  strengths: string[];
  improvements: string[];
  completedAt: string;        // ISO date
}

/** In-memory session state. */
export interface AssessmentSession {
  id: string;
  userId: string;
  resumeId: string;
  skills: string[];
  questions: AssessmentQuestion[];
  answers: Map<string, string>;
  status: "ACTIVE" | "SUBMITTED" | "GRADED";
  timeLimit: number;           // seconds (default 1800 = 30 min)
  startedAt: number;           // Date.now()
  expiresAt: number;           // startedAt + TTL
  scorecard?: Scorecard;
  /** Last successful or incomplete GitHub verification for this session (never a failure). */
  githubReport?: VerificationReport;
  githubState?: GithubReportState;
}

// ---------------------------------------------------------------------------
// API Request / Response shapes
// ---------------------------------------------------------------------------

export interface GenerateRequest {
  resumeId: string;
}

export interface GenerateResponse {
  sessionId: string;
  totalQuestions: number;
  timeLimit: number;
  skills: string[];
}

export interface QuestionsResponse {
  sessionId: string;
  questions: ClientQuestion[];
  timeLimit: number;
  startedAt: number;
  remainingSeconds: number;
}

export interface SubmitRequest {
  answers: Record<string, string>;
}

export interface SubmitResponse {
  message: string;
  sessionId: string;
}

export interface ScorecardResponse {
  scorecard: Scorecard;
}
