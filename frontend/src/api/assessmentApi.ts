// Central API client for the PlacementHub Assessment feature.
// All requests go through this module so the base URL is configured in one place.

import { refreshApi } from './auth';

const API_BASE = 'http://localhost:4000/api/v1';


export class ApiError extends Error {
    status: number;
    constructor(
        status: number,
        message: string,
    ) {
        super(message);
        this.status = status;
        this.name = 'ApiError';
    }
}

// Assessment routes require a logged-in user. useAssessment keeps this in sync with AuthContext.
let accessToken: string | null = null;
export function setAssessmentToken(token: string | null) {
    accessToken = token;
}

async function request<T>(path: string, options?: RequestInit, retried = false): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);

    try {
        const res = await fetch(`${API_BASE}${path}`, {
            credentials: 'include', // refresh-token cookie, used for the 401 retry below
            headers: {
                // For FormData the browser must set the multipart boundary itself.
                ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
                ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
            signal: controller.signal,
            ...options,
        });

        clearTimeout(timeoutId);

        // Access tokens last 15 minutes but an assessment can run longer: refresh once and retry.
        if (res.status === 401 && !retried) {
            try {
                accessToken = (await refreshApi()).data.accessToken;
                return request<T>(path, options, true);
            } catch {
                /* fall through to the original 401 */
            }
        }

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new ApiError(res.status, data.message ?? 'An unexpected error occurred');
        }

        return data as T;
    } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof ApiError) throw err;
        if ((err as Error)?.name === 'AbortError') {
            throw new ApiError(504, 'The request timed out. Please try again.');
        }
        throw new ApiError(500, (err as Error)?.message ?? 'Network error connecting to server');
    }
}

// ---------------------------------------------------------------------------
// Types (mirrors backend public types)
// ---------------------------------------------------------------------------

// Subset of the resume parser's output (backend/src/resume/schema.ts) that the UI shows.
export interface ParsedResume {
    skills: { name: string; canonical_name: string | null; category: string | null; claim_type: string }[];
    projects: {
        name: string;
        description: string | null;
        technologies: string[];
        features: { claim: string }[];
    }[];
    experience: {
        organization: string | null;
        title: string | null;
        start_date: string | null;
        end_date: string | null;
        is_current: boolean | null;
        responsibilities: string[];
    }[];
}

export interface StoredResume {
    id: string;
    createdAt: string;
    resume: ParsedResume;
}

export interface PublicQuestion {
    id: string;
    type: 'mcq' | 'short_answer' | 'debugging' | 'scenario' | 'coding' | 'project';
    text: string;
    skills: string[];
    primarySkill: string;
    difficulty: 'easy' | 'medium' | 'hard';
    maxMarks: number;
    options?: { id: string; text: string }[];
    expectedLanguage?: string;
    expectedBehavior?: string;
}

export interface GenerateAssessmentResponse {
    success: boolean;
    data: {
        assessmentId: string;
        resumeId: string;
        config: {
            questionCount: number;
            difficulty: string;
            durationMinutes: number;
        };
        questions: PublicQuestion[];
        totalMaxMarks: number;
        questionCount: number;
        expiresAt: string;
    };
}

export interface CriterionScore {
    criterion: string;
    maxMarks: number;
    awardedMarks: number;
    reason: string;
}

export interface QuestionResult {
    questionId: string;
    skill: string;
    questionType: string;
    maxMarks: number;
    awardedMarks: number;
    criterionScores: CriterionScore[];
    feedback: string;
    strengths: string[];
    improvements: string[];
    wasAnswered: boolean;
    evaluationMethod: 'ai_reviewed' | 'auto_correct' | 'unanswered';
}

export interface SkillResult {
    skill: string;
    marksEarned: number;
    marksAvailable: number;
    percentage: number;
    status: 'demonstrated' | 'developing' | 'needs_improvement' | 'not_assessed';
    questionCount: number;
}

export interface AssessmentResult {
    assessmentId: string;
    resumeId: string;
    totalMarksEarned: number;
    totalMarksAvailable: number;
    overallPercentage: number;
    questionResults: QuestionResult[];
    skillResults: SkillResult[];
    aggregatedStrengths: string[];
    aggregatedImprovements: string[];
    evaluatedAt: string;
    evaluationNote: string;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** The signed-in user's previously parsed resumes, newest first. */
export async function fetchResumes(): Promise<{ data: StoredResume[] }> {
    return request<{ data: StoredResume[] }>('/resumes');
}

/** Uploads a PDF/DOCX; the backend parses it with Gemini and stores the result. */
export async function uploadResume(file: File): Promise<StoredResume> {
    const form = new FormData();
    form.append('resume', file);
    const res = await request<{ data: { id: string; resume: ParsedResume } }>('/resumes', {
        method: 'POST',
        body: form,
    });
    return { id: res.data.id, resume: res.data.resume, createdAt: new Date().toISOString() };
}

export async function generateAssessment(payload: {
    resumeId: string;
    config?: {
        questionCount?: number;
        difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
        durationMinutes?: number;
    };
}): Promise<GenerateAssessmentResponse> {
    return request<GenerateAssessmentResponse>('/assessments/generate', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function submitAssessment(
    assessmentId: string,
    answers: { questionId: string; answer: string }[],
): Promise<{ success: boolean; data: AssessmentResult }> {
    return request<{ success: boolean; data: AssessmentResult }>(
        `/assessments/${assessmentId}/submit`,
        {
            method: 'POST',
            body: JSON.stringify({ answers }),
        },
    );
}

export async function fetchResults(
    assessmentId: string,
): Promise<{ success: boolean; data: AssessmentResult }> {
    return request<{ success: boolean; data: AssessmentResult }>(
        `/assessments/${assessmentId}/results`,
    );
}
