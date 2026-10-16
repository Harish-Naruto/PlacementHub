/**
 * Assessment Generator Service
 *
 * Responsible for:
 *   1. Fetching the selected resume from the mock data store.
 *   2. Building a structured Gemini prompt based on the resume.
 *   3. Calling Gemini to generate a personalised assessment.
 *   4. Validating the response with Zod.
 *   5. Returning the validated GeneratedAssessment.
 */

import { z } from 'zod/v4';
import { callGemini, extractJSON } from '../lib/gemini';
import { getMockResumeById, MockResume } from '../data/mockResumes';
import {
    AssessmentConfig,
    GeneratedAssessment,
    GeneratedAssessmentSchema,
    PrivateQuestion,
    PrivateQuestionSchema,
} from '../types/assessment';
import { ApiError } from '../utils/apiError';

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildResumeContext(resume: MockResume): string {
    const projects = resume.projects
        .map(
            (p, i) =>
                `  Project ${i + 1}: "${p.title}"\n  Description: ${p.description}\n  Technologies: ${p.technologies.join(', ')}`,
        )
        .join('\n\n');

    const experience =
        resume.experience.length > 0
            ? resume.experience
                  .map(
                      (e) =>
                          `  ${e.role} at ${e.company} (${e.duration}): ${e.description}`,
                  )
                  .join('\n')
            : '  None';

    return `
Student Name: ${resume.name}
Degree: ${resume.education.degree} (Graduating ${resume.education.graduationYear})
Institution: ${resume.education.institution}
Skills: ${resume.skills.join(', ')}

Projects:
${projects}

Work Experience:
${experience}
`.trim();
}

function buildGenerationPrompt(resume: MockResume, config: AssessmentConfig): string {
    return `
You are an expert technical interviewer generating a personalised skill assessment for a placement platform.

CANDIDATE RESUME:
${buildResumeContext(resume)}

ASSESSMENT REQUIREMENTS:
- Total questions: ${config.questionCount}
- Difficulty: ${config.difficulty}
- Duration: ${config.durationMinutes} minutes
- Target total marks: 100 (distribute proportionally based on question complexity)

QUESTION TYPE DISTRIBUTION (adjust if the resume cannot support a type):
- 4 MCQs (multiple choice, single correct answer)
- 3 short-answer technical questions
- 2 debugging or scenario-based questions
- 2 coding questions (with clear expected language and behaviour)
- 1 project-based question

CRITICAL RULES:
1. Every question must be directly relevant to at least one skill or project listed in the resume above.
2. Do NOT generate generic computer science questions unrelated to the candidate's background.
3. Do NOT assume details absent from the resume description.
4. For project-based questions, reference only what is explicitly described.
5. Generate meaningfully different questions — do not ask the same concept twice.
6. MCQ options must have exactly 4 options labeled A, B, C, D.
7. Coding questions must specify expectedLanguage and expectedBehavior.

OUTPUT FORMAT:
Return ONLY a valid JSON object (no markdown fences, no commentary) with this exact structure:
{
  "questions": [
    {
      "id": "q1",
      "type": "mcq" | "short_answer" | "debugging" | "scenario" | "coding" | "project",
      "text": "Question text here",
      "skills": ["Skill1", "Skill2"],
      "primarySkill": "Skill1",
      "difficulty": "easy" | "medium" | "hard",
      "maxMarks": <number>,
      "options": [
        {"id": "A", "text": "Option text"},
        {"id": "B", "text": "Option text"},
        {"id": "C", "text": "Option text"},
        {"id": "D", "text": "Option text"}
      ],
      "correctOptionId": "A",
      "expectedAnswer": "Complete expected answer / rubric answer",
      "gradingRubric": "How to award marks for this question",
      "gradingCriteria": [
        {"criterion": "Technical correctness", "maxMarks": 4, "description": "..."},
        {"criterion": "Completeness", "maxMarks": 3, "description": "..."}
      ],
      "expectedLanguage": "TypeScript",
      "expectedBehavior": "The function should..."
    }
  ],
  "totalMaxMarks": <sum of all maxMarks>
}

Notes:
- Include "options" and "correctOptionId" ONLY for MCQ questions.
- Include "expectedLanguage" and "expectedBehavior" ONLY for coding questions.
- "gradingCriteria" maxMarks must sum to "maxMarks" for each question.
- "totalMaxMarks" must equal the sum of all question maxMarks.
`.trim();
}

// ---------------------------------------------------------------------------
// Zod schema for raw Gemini output (before mapping to internal types)
// ---------------------------------------------------------------------------

const RawQuestionSchema = z.object({
    id: z.string(),
    type: z.enum(['mcq', 'short_answer', 'debugging', 'scenario', 'coding', 'project']),
    text: z.string(),
    skills: z.array(z.string()).min(1),
    primarySkill: z.string(),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    maxMarks: z.number().positive(),
    options: z
        .array(
            z.object({
                id: z.string(),
                text: z.string(),
            }),
        )
        .optional(),
    correctOptionId: z.string().optional(),
    expectedAnswer: z.string(),
    gradingRubric: z.string(),
    gradingCriteria: z.array(
        z.object({
            criterion: z.string(),
            maxMarks: z.number().positive(),
            description: z.string(),
        }),
    ),
    expectedLanguage: z.string().optional(),
    expectedBehavior: z.string().optional(),
});

const RawAssessmentSchema = z.object({
    questions: z.array(RawQuestionSchema).min(1),
    totalMaxMarks: z.number().positive(),
});

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateParsedAssessment(raw: z.infer<typeof RawAssessmentSchema>): GeneratedAssessment {
    // Recalculate totalMaxMarks from questions to prevent prompt-injection overrides
    const computedTotal = raw.questions.reduce((sum, q) => sum + q.maxMarks, 0);

    const questions: PrivateQuestion[] = raw.questions.map((q) => {
        // Validate criterion scores sum
        const criterionSum = q.gradingCriteria.reduce((s, c) => s + c.maxMarks, 0);
        if (Math.abs(criterionSum - q.maxMarks) > 0.01) {
            // Proportionally rescale criteria to match maxMarks
            const scale = q.maxMarks / criterionSum;
            q.gradingCriteria = q.gradingCriteria.map((c) => ({
                ...c,
                maxMarks: Math.round(c.maxMarks * scale * 10) / 10,
            }));
        }

        // MCQ validation
        if (q.type === 'mcq') {
            if (!q.options || q.options.length < 2) {
                throw new ApiError(
                    `MCQ question "${q.id}" must have at least 2 options`,
                    500,
                );
            }
            if (!q.correctOptionId) {
                throw new ApiError(
                    `MCQ question "${q.id}" must have a correctOptionId`,
                    500,
                );
            }
        }

        return PrivateQuestionSchema.parse(q);
    });

    return GeneratedAssessmentSchema.parse({
        questions,
        totalMaxMarks: computedTotal,
    });
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function generateAssessment(
    resumeId: string,
    config: AssessmentConfig,
): Promise<GeneratedAssessment> {
    const resume = getMockResumeById(resumeId);
    if (!resume) {
        throw new ApiError(`Resume with id "${resumeId}" not found`, 404);
    }

    const prompt = buildGenerationPrompt(resume, config);

    let rawText: string;
    try {
        rawText = await callGemini(prompt);
    } catch (err) {
        throw new ApiError(
            `Gemini API call failed during assessment generation: ${err instanceof Error ? err.message : String(err)}`,
            502,
        );
    }

    let parsed: unknown;
    try {
        parsed = extractJSON(rawText);
    } catch {
        throw new ApiError(
            'Gemini returned malformed JSON during assessment generation. Cannot fabricate questions.',
            502,
        );
    }

    let rawAssessment: z.infer<typeof RawAssessmentSchema>;
    try {
        rawAssessment = RawAssessmentSchema.parse(parsed);
    } catch (err) {
        throw new ApiError(
            `Gemini assessment response failed schema validation: ${err instanceof Error ? err.message : String(err)}`,
            502,
        );
    }

    try {
        return validateParsedAssessment(rawAssessment);
    } catch (err) {
        if (err instanceof ApiError) throw err;
        throw new ApiError(
            `Assessment validation failed: ${err instanceof Error ? err.message : String(err)}`,
            500,
        );
    }
}
