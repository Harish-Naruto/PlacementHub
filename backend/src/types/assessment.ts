import { z } from 'zod/v4';

// ---------------------------------------------------------------------------
// Assessment configuration
// ---------------------------------------------------------------------------

export const AssessmentConfigSchema = z.object({
    questionCount: z.number().int().min(1).max(30).default(12),
    difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).default('mixed'),
    durationMinutes: z.number().int().min(5).max(120).default(20),
});
export type AssessmentConfig = z.infer<typeof AssessmentConfigSchema>;

// ---------------------------------------------------------------------------
// Question types stored on the backend (includes private grading data)
// ---------------------------------------------------------------------------

export const QuestionTypeSchema = z.enum([
    'mcq',
    'short_answer',
    'debugging',
    'scenario',
    'coding',
    'project',
]);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const DifficultySchema = z.enum(['easy', 'medium', 'hard']);

// MCQ options
export const MCQOptionSchema = z.object({
    id: z.string(),
    text: z.string(),
});

// Grading criterion stored privately
export const GradingCriterionSchema = z.object({
    criterion: z.string(),
    maxMarks: z.number(),
    description: z.string(),
});

// Full private question (backend only)
export const PrivateQuestionSchema = z.object({
    id: z.string(),
    type: QuestionTypeSchema,
    text: z.string(),
    skills: z.array(z.string()),
    primarySkill: z.string(),
    difficulty: DifficultySchema,
    maxMarks: z.number(),
    // MCQ only
    options: z.array(MCQOptionSchema).optional(),
    correctOptionId: z.string().optional(),
    // All types
    expectedAnswer: z.string(),
    gradingRubric: z.string(),
    gradingCriteria: z.array(GradingCriterionSchema),
    // Coding only
    expectedLanguage: z.string().optional(),
    expectedBehavior: z.string().optional(),
});
export type PrivateQuestion = z.infer<typeof PrivateQuestionSchema>;

// Public question (sent to frontend — no answer keys)
export interface PublicQuestion {
    id: string;
    type: QuestionType;
    text: string;
    skills: string[];
    primarySkill: string;
    difficulty: 'easy' | 'medium' | 'hard';
    maxMarks: number;
    options?: { id: string; text: string }[];
    expectedLanguage?: string;
    expectedBehavior?: string;
}

export function toPublicQuestion(q: PrivateQuestion): PublicQuestion {
    return {
        id: q.id,
        type: q.type,
        text: q.text,
        skills: q.skills,
        primarySkill: q.primarySkill,
        difficulty: q.difficulty,
        maxMarks: q.maxMarks,
        ...(q.options ? { options: q.options } : {}),
        ...(q.expectedLanguage ? { expectedLanguage: q.expectedLanguage } : {}),
        ...(q.expectedBehavior ? { expectedBehavior: q.expectedBehavior } : {}),
    };
}

// Full generated assessment stored in the session
export const GeneratedAssessmentSchema = z.object({
    questions: z.array(PrivateQuestionSchema),
    totalMaxMarks: z.number(),
});
export type GeneratedAssessment = z.infer<typeof GeneratedAssessmentSchema>;

// ---------------------------------------------------------------------------
// Assessment session (in-memory store)
// ---------------------------------------------------------------------------

export type SubmissionStatus = 'pending' | 'submitted' | 'evaluated' | 'error';

export interface AssessmentSession {
    assessmentId: string;
    resumeId: string;
    config: AssessmentConfig;
    privateAssessment: GeneratedAssessment;
    publicQuestions: PublicQuestion[];
    createdAt: Date;
    expiresAt: Date;
    submittedAt?: Date;
    submissionStatus: SubmissionStatus;
    result?: AssessmentResult;
}

// ---------------------------------------------------------------------------
// Submission types
// ---------------------------------------------------------------------------

export const StudentAnswerSchema = z.object({
    questionId: z.string(),
    answer: z.string(), // For MCQ: option id; for others: free text or code
});
export type StudentAnswer = z.infer<typeof StudentAnswerSchema>;

export const SubmitAssessmentBodySchema = z.object({
    answers: z.array(StudentAnswerSchema),
});

// ---------------------------------------------------------------------------
// Evaluation / result types
// ---------------------------------------------------------------------------

export const CriterionScoreSchema = z.object({
    criterion: z.string(),
    maxMarks: z.number(),
    awardedMarks: z.number(),
    reason: z.string(),
});
export type CriterionScore = z.infer<typeof CriterionScoreSchema>;

export const QuestionResultSchema = z.object({
    questionId: z.string(),
    skill: z.string(),
    questionType: QuestionTypeSchema,
    maxMarks: z.number(),
    awardedMarks: z.number(),
    criterionScores: z.array(CriterionScoreSchema),
    feedback: z.string(),
    strengths: z.array(z.string()),
    improvements: z.array(z.string()),
    wasAnswered: z.boolean(),
    evaluationMethod: z.enum(['ai_reviewed', 'auto_correct', 'unanswered']),
});
export type QuestionResult = z.infer<typeof QuestionResultSchema>;

export type SkillStatus = 'demonstrated' | 'developing' | 'needs_improvement' | 'not_assessed';

export interface SkillResult {
    skill: string;
    marksEarned: number;
    marksAvailable: number;
    percentage: number;
    status: SkillStatus;
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
    evaluatedAt: Date;
    evaluationNote: string;
}
