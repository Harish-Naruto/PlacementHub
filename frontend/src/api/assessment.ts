// ---------------------------------------------------------------------------
// Assessment API Client
// ---------------------------------------------------------------------------

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api/v1";

async function request<T>(
  endpoint: string,
  token?: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `HTTP error ${response.status}`);
  }

  return data;
}

export type QuestionType = "MCQ" | "SHORT_ANSWER" | "CODE_ANALYSIS";

export interface MCQOption {
  label: string;
  text: string;
}

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

export interface QuestionGrade {
  questionId: string;
  skill: string;
  type: QuestionType;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  maxPoints: number;
  awardedPoints: number;
  feedback: string;
}

export interface Scorecard {
  sessionId: string;
  resumeId: string;
  totalPoints: number;
  maxPoints: number;
  percentage: number;
  grade: string;
  skillBreakdown: {
    skill: string;
    totalPoints: number;
    maxPoints: number;
    percentage: number;
  }[];
  questionResults: QuestionGrade[];
  summary: string;
  strengths: string[];
  improvements: string[];
  completedAt: string;
}

export interface GeneratedAssessmentData {
  sessionId: string;
  totalQuestions: number;
  timeLimit: number;
  skills: string[];
}

export interface AssessmentQuestionsData {
  sessionId: string;
  status: "ACTIVE" | "SUBMITTED" | "GRADED";
  questions: ClientQuestion[];
  savedAnswers: Record<string, string>;
  timeLimit: number;
  startedAt: number;
  remainingSeconds: number;
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

export async function generateAssessmentApi(
  token: string,
  resumeId: string,
): Promise<GeneratedAssessmentData> {
  const res = await request<{ error: boolean; data: GeneratedAssessmentData }>(
    "/assessments/generate",
    token,
    {
      method: "POST",
      body: JSON.stringify({ resumeId }),
    },
  );
  return res.data;
}

export async function fetchAssessmentQuestionsApi(
  token: string,
  sessionId: string,
): Promise<AssessmentQuestionsData> {
  const res = await request<{ error: boolean; data: AssessmentQuestionsData }>(
    `/assessments/${sessionId}/questions`,
    token,
  );
  return res.data;
}

export async function submitAssessmentApi(
  token: string,
  sessionId: string,
  answers: Record<string, string>,
): Promise<{ message: string; sessionId: string; scorecard: Scorecard }> {
  const res = await request<{
    error: boolean;
    data: { message: string; sessionId: string; scorecard: Scorecard };
  }>(`/assessments/${sessionId}/submit`, token, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
  return res.data;
}

// ---------------------------------------------------------------------------
// Per-skill verification (assessment score + GitHub evidence -> combined score)
// ---------------------------------------------------------------------------

export type SkillVerificationStatus =
  | "verified"
  | "partially_verified"
  | "needs_review"
  | "unsupported"
  | "unverified";

export type GithubSkillStatus =
  | "supported"
  | "partially_supported"
  | "insufficient_evidence"
  | "needs_review"
  | "not_accessible"
  | "not_checked"
  | "not_run";

export type GithubReportState = "completed" | "incomplete" | "not_run" | "failed";

export interface SkillEvidenceRef {
  type: "dependency" | "source_usage" | "configuration" | "contribution";
  repositoryUrl: string;
  evidenceUrl?: string;
  commitSha?: string;
}

export interface CombinedSkillResult {
  skill: string;
  assessmentScore: number | null;
  githubEvidenceScore: number | null;
  combinedScore: number | null;
  verification: { status: SkillVerificationStatus; flagged: boolean; reason: string };
  githubStatus: GithubSkillStatus;
  evidenceStrength: "high" | "medium" | "low" | "unknown";
  evidenceSummary: string;
  evidenceUrls: string[];
  assessmentPoints: { earned: number; possible: number } | null;
  assessmentQuestionIds: string[];
  evidence: SkillEvidenceRef[];
  conflicts: string[];
  resumeReferences: string[];
}

export interface SkillScoresData {
  sessionId: string;
  resumeId: string;
  weights: { assessment: number; github: number };
  thresholds: { pass: number; fail: number };
  verification: Record<SkillVerificationStatus, number> & { total: number; flagged: number };
  github: {
    state: GithubReportState;
    username?: string;
    checkedAt?: string;
    repositoriesInspected?: number;
    limitations: string[];
    error?: { code: string; message: string };
  };
  skills: CombinedSkillResult[];
  note: string;
  /** Present on the POST response: what was saved to the student's skill profile. */
  persistence?:
    | { skills: number; evidenceCreated: number; evidenceUpdated: number; statusesChanged: number; failed: number }
    | { error: string };
}

/** Scores from the assessment (and the last GitHub report, if any). Makes no GitHub requests. */
export async function fetchSkillScoresApi(token: string, sessionId: string): Promise<SkillScoresData> {
  const res = await request<{ error: boolean; data: SkillScoresData }>(
    `/assessments/${sessionId}/skill-scores`,
    token,
  );
  return res.data;
}

/** Runs GitHub verification for the session's resume, then returns the combined scores. */
export async function runSkillVerificationApi(
  token: string,
  sessionId: string,
  githubUsername?: string,
): Promise<SkillScoresData> {
  const res = await request<{ error: boolean; data: SkillScoresData }>(
    `/assessments/${sessionId}/skill-scores`,
    token,
    {
      method: "POST",
      body: JSON.stringify(githubUsername?.trim() ? { githubUsername: githubUsername.trim() } : {}),
    },
  );
  return res.data;
}

export async function fetchAssessmentScorecardApi(
  token: string,
  sessionId: string,
): Promise<Scorecard> {
  const res = await request<{ error: boolean; data: Scorecard }>(
    `/assessments/${sessionId}/scorecard`,
    token,
  );
  return res.data;
}
