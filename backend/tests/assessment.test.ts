import { beforeEach, describe, expect, mock, test } from 'bun:test';
import sample from '../resumeparser.output.json';

// Stub Gemini and Prisma before the services are imported.
let geminiCalls: { prompt: string }[] = [];
let geminiReply: (prompt: string) => unknown = () => ({});
mock.module('../src/lib/gemini', () => ({
    generateJSON: async (o: { prompt: string; schema: { parse: (v: unknown) => unknown } }) => {
        geminiCalls.push({ prompt: o.prompt });
        return o.schema.parse(geminiReply(o.prompt));
    },
}));
const RESUME_ID = '5d006ca6-91e0-4564-92ef-90eedb3c4944';
mock.module('../src/config/prisma', () => ({
    default: {
        parsedResume: {
            findUnique: async ({ where }: { where: { id: string } }) =>
                where.id === RESUME_ID ? { id: RESUME_ID, userId: 'user-1', data: sample.data.resume } : null,
        },
    },
}));

const { profileFromParsedResume } = await import('../src/services/assessmentProfile.service');
const { generateAssessment } = await import('../src/services/assessmentGenerator.service');
const { evaluateAssessment } = await import('../src/services/assessmentEvaluator.service');

const parsed = sample.data.resume as Parameters<typeof profileFromParsedResume>[0];

beforeEach(() => {
    geminiCalls = [];
});

describe('profile from parsed resume', () => {
    const profile = profileFromParsedResume(parsed);

    test('merges duplicate mentions and drops tooling', () => {
        expect(new Set(profile.skills).size).toBe(profile.skills.length);
        expect(profile.skills).toContain('Express.js');
        for (const tool of ['Git', 'GitHub', 'VS Code', 'Postman', 'npm', 'Bun']) {
            expect(profile.skills).not.toContain(tool);
        }
        expect(profile.skills.length).toBeLessThanOrEqual(10);
    });

    test('skills used in projects rank above list-only skills', () => {
        expect(profile.skills.indexOf('PostgreSQL')).toBeLessThan(profile.skills.indexOf('C++') === -1 ? 99 : profile.skills.indexOf('C++'));
    });

    test('keeps projects with capped highlights', () => {
        expect(profile.projects.map((p) => p.name)).toEqual(['COC Ecosystem', 'Web-Escape', 'GrievanceHUB']);
        expect(profile.projects[0].highlights.length).toBeLessThanOrEqual(3);
    });
});

const llmMcq = (correct: string, over: Record<string, unknown> = {}) => ({
    type: 'mcq',
    text: 'Which is right?',
    skills: ['React'],
    primarySkill: 'React',
    difficulty: 'easy',
    options: [
        { id: 'A', text: 'one' },
        { id: 'B', text: 'two' },
        { id: 'C', text: 'three' },
        { id: 'D', text: 'four' },
    ],
    correctOptionId: correct,
    expectedAnswer: 'because',
    ...over,
});
const llmText = (type: string) => ({
    type,
    text: 'Explain',
    skills: ['Node.js'],
    primarySkill: 'Node.js',
    difficulty: 'medium',
    expectedAnswer: 'key points',
});

describe('generateAssessment', () => {
    test('one Gemini call; ids, marks and difficulty are server-assigned; MCQ key survives shuffle', async () => {
        geminiReply = () => ({
            questions: [llmMcq('B'), llmMcq('C'), llmText('short_answer'), llmText('coding'), llmText('scenario'), llmMcq('A')],
        });
        const a = await generateAssessment(RESUME_ID, 'user-1', { questionCount: 6, difficulty: 'hard', durationMinutes: 20 });

        expect(geminiCalls).toHaveLength(1);
        expect(a.questions.map((q) => q.id)).toEqual(['q1', 'q2', 'q3', 'q4', 'q5', 'q6']);
        expect(a.questions.every((q) => q.difficulty === 'hard')).toBe(true);
        expect(a.totalMaxMarks).toBe(4 + 4 + 8 + 12 + 8 + 4);

        const q1 = a.questions[0];
        const key = q1.options!.find((o) => o.id === q1.correctOptionId)!;
        expect(key.text).toBe('two'); // original B survives relabelling
        expect(q1.options!.map((o) => o.id)).toEqual(['A', 'B', 'C', 'D']);
    });

    test('drops malformed MCQs but fails if most of the set is unusable', async () => {
        geminiReply = () => ({
            questions: [llmMcq('Z'), llmMcq('A', { options: [] }), llmMcq('A'), llmText('short_answer'), llmText('coding'), llmText('scenario')],
        });
        const a = await generateAssessment(RESUME_ID, 'user-1', { questionCount: 6, difficulty: 'mixed', durationMinutes: 20 });
        expect(a.questions).toHaveLength(4);

        geminiReply = () => ({ questions: [llmMcq('Z'), llmMcq('Z'), llmMcq('Z'), llmMcq('Z')] });
        await expect(
            generateAssessment(RESUME_ID, 'user-1', { questionCount: 6, difficulty: 'mixed', durationMinutes: 20 }),
        ).rejects.toThrow('valid assessment');
    });

    test('unknown, non-uuid (old mock ids) and other users\' resumes are a 404 and never reach Gemini', async () => {
        const cfg = { questionCount: 6, difficulty: 'mixed', durationMinutes: 20 } as const;
        for (const [id, user] of [
            ['resume_001', 'user-1'],
            ['11111111-1111-1111-1111-111111111111', 'user-1'],
            [RESUME_ID, 'someone-else'],
        ]) {
            await expect(generateAssessment(id, user, cfg)).rejects.toMatchObject({ statusCode: 404 });
        }
        expect(geminiCalls).toHaveLength(0);
    });
});

describe('evaluateAssessment', () => {
    const session = {
        assessmentId: 'a1',
        userId: 'user-1',
        resumeId: RESUME_ID,
        config: { questionCount: 4, difficulty: 'mixed', durationMinutes: 20 },
        publicQuestions: [],
        createdAt: new Date(),
        expiresAt: new Date(),
        submissionStatus: 'pending',
        privateAssessment: {
            totalMaxMarks: 4 + 4 + 8 + 12,
            questions: [
                { id: 'q1', type: 'mcq', text: '', skills: ['React'], primarySkill: 'React', difficulty: 'easy', maxMarks: 4, correctOptionId: 'B', expectedAnswer: 'x' },
                { id: 'q2', type: 'mcq', text: '', skills: ['React'], primarySkill: 'React', difficulty: 'easy', maxMarks: 4, correctOptionId: 'C', expectedAnswer: 'x' },
                { id: 'q3', type: 'short_answer', text: '', skills: ['Node.js'], primarySkill: 'Node.js', difficulty: 'easy', maxMarks: 8, expectedAnswer: 'x' },
                { id: 'q4', type: 'coding', text: '', skills: ['Node.js'], primarySkill: 'Node.js', difficulty: 'easy', maxMarks: 12, expectedAnswer: 'x' },
            ],
        },
    } as Parameters<typeof evaluateAssessment>[0];

    test('MCQs and blanks never call Gemini', async () => {
        const r = await evaluateAssessment(session, [
            { questionId: 'q1', answer: 'b' },
            { questionId: 'q2', answer: 'A' },
            { questionId: 'q3', answer: '   ' },
        ]);
        expect(geminiCalls).toHaveLength(0);
        expect(r.questionResults.map((q) => q.awardedMarks)).toEqual([4, 0, 0, 0]);
        expect(r.totalMarksEarned).toBe(4);
        expect(r.overallPercentage).toBeCloseTo(14.3, 1);
    });

    test('all free-text answers are graded in one batched call; marks are clamped', async () => {
        geminiReply = () => ({
            grades: [
                { questionId: 'q3', awardedMarks: 99, feedback: 'ok', strengths: ['a'], improvements: [] },
                { questionId: 'q4', awardedMarks: -3, feedback: 'bad', strengths: [], improvements: ['b'] },
            ],
        });
        const r = await evaluateAssessment(session, [
            { questionId: 'q3', answer: 'answer' },
            { questionId: 'q4', answer: 'code' },
        ]);
        expect(geminiCalls).toHaveLength(1);
        expect(r.questionResults[2].awardedMarks).toBe(8);
        expect(r.questionResults[3].awardedMarks).toBe(0);
    });

    test('a skipped grade is an error, not a made-up score', async () => {
        geminiReply = () => ({ grades: [{ questionId: 'q3', awardedMarks: 5, feedback: 'ok', strengths: [], improvements: [] }] });
        await expect(
            evaluateAssessment(session, [
                { questionId: 'q3', answer: 'answer' },
                { questionId: 'q4', answer: 'code' },
            ]),
        ).rejects.toThrow('did not grade');
    });
});
