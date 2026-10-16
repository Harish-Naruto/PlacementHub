// Central API client for the PlacementHub Assessment feature.
// All requests go through this module so the base URL is configured in one place.

const API_BASE = 'http://localhost:4000/api/v1';


export class ApiError extends Error {
    constructor(
        public status: number,
        message: string,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });

    const data = await res.json();

    if (!res.ok) {
        throw new ApiError(res.status, data.message ?? 'An unexpected error occurred');
    }

    return data as T;
}

// ---------------------------------------------------------------------------
// Types (mirrors backend public types)
// ---------------------------------------------------------------------------

export interface MockResumeSummary {
    id: string;
    name: string;
    education: {
        degree: string;
        institution: string;
        graduationYear: number;
        cgpa?: number;
    };
    skills: string[];
    projects: {
        title: string;
        description: string;
        technologies: string[];
    }[];
    experience: {
        company: string;
        role: string;
        duration: string;
        description: string;
    }[];
    githubUsername?: string;
    linkedinUrl?: string;
    _isDummyTestData: true;
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

export async function fetchResumes(): Promise<{ data: MockResumeSummary[] }> {
    return request<{ data: MockResumeSummary[] }>('/mock/resumes');
}

export async function fetchResume(id: string): Promise<{ data: MockResumeSummary }> {
    return request<{ data: MockResumeSummary }>(`/mock/resumes/${id}`);
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
