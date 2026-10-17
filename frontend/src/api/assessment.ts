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
