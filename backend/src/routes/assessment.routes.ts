import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod/v4';
import { generateAssessment } from '../services/assessmentGenerator.service';
import { evaluateAssessment } from '../services/assessmentEvaluator.service';
import { sessionStore, SESSION_TTL_MS } from '../store/sessionStore';
import {
    AssessmentConfigSchema,
    SubmitAssessmentBodySchema,
    toPublicQuestion,
} from '../types/assessment';
import { ApiError } from '../utils/apiError';

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/v1/assessments/generate
// ---------------------------------------------------------------------------

const GenerateBodySchema = z.object({
    resumeId: z.string().min(1),
    config: AssessmentConfigSchema.optional(),
});

router.post('/generate', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const parsed = GenerateBodySchema.safeParse(req.body);
        if (!parsed.success) {
            return next(new ApiError(`Invalid request body: ${parsed.error.message}`, 400));
        }

        const { resumeId, config: rawConfig } = parsed.data;
        const config = AssessmentConfigSchema.parse(rawConfig ?? {});

        const privateAssessment = await generateAssessment(resumeId, config);

        const assessmentId = `asmnt_${randomUUID()}`;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
        const publicQuestions = privateAssessment.questions.map(toPublicQuestion);

        const session = {
            assessmentId,
            resumeId,
            config,
            privateAssessment,
            publicQuestions,
            createdAt: now,
            expiresAt,
            submissionStatus: 'pending' as const,
        };

        sessionStore.set(session);

        res.status(201).json({
            success: true,
            data: {
                assessmentId,
                resumeId,
                config,
                questions: publicQuestions,
                totalMaxMarks: privateAssessment.totalMaxMarks,
                questionCount: publicQuestions.length,
                expiresAt,
                _sessionNote:
                    'This session is stored in server memory only. It will be lost on server restart and is not shared across multiple instances.',
            },
        });
    } catch (err) {
        next(err);
    }
});

// ---------------------------------------------------------------------------
// GET /api/v1/assessments/:assessmentId
// ---------------------------------------------------------------------------

router.get('/:assessmentId', (req: Request, res: Response, next: NextFunction) => {
    const { assessmentId } = req.params;
    const session = sessionStore.get(assessmentId);

    if (!session) {
        return next(new ApiError(`Assessment "${assessmentId}" not found or has expired`, 404));
    }

    res.status(200).json({
        success: true,
        data: {
            assessmentId: session.assessmentId,
            resumeId: session.resumeId,
            config: session.config,
            questions: session.publicQuestions,
            totalMaxMarks: session.privateAssessment.totalMaxMarks,
            questionCount: session.publicQuestions.length,
            submissionStatus: session.submissionStatus,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
        },
    });
});

// ---------------------------------------------------------------------------
// POST /api/v1/assessments/:assessmentId/submit
// ---------------------------------------------------------------------------

router.post('/:assessmentId/submit', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { assessmentId } = req.params;
        const session = sessionStore.get(assessmentId);

        if (!session) {
            return next(new ApiError(`Assessment "${assessmentId}" not found or has expired`, 404));
        }

        if (session.submissionStatus !== 'pending') {
            return next(
                new ApiError(
                    `Assessment "${assessmentId}" has already been submitted (status: ${session.submissionStatus})`,
                    409,
                ),
            );
        }

        const parsed = SubmitAssessmentBodySchema.safeParse(req.body);
        if (!parsed.success) {
            return next(new ApiError(`Invalid submission body: ${parsed.error.message}`, 400));
        }

        const { answers } = parsed.data;

        // Mark as submitted immediately to prevent double-submission
        sessionStore.update(assessmentId, {
            submissionStatus: 'submitted',
            submittedAt: new Date(),
        });

        try {
            const result = await evaluateAssessment(session, answers);

            sessionStore.update(assessmentId, {
                submissionStatus: 'evaluated',
                result,
            });

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (evalErr) {
            sessionStore.update(assessmentId, { submissionStatus: 'error' });
            throw evalErr;
        }
    } catch (err) {
        next(err);
    }
});

// ---------------------------------------------------------------------------
// GET /api/v1/assessments/:assessmentId/results
// ---------------------------------------------------------------------------

router.get('/:assessmentId/results', (req: Request, res: Response, next: NextFunction) => {
    const { assessmentId } = req.params;
    const session = sessionStore.get(assessmentId);

    if (!session) {
        return next(new ApiError(`Assessment "${assessmentId}" not found or has expired`, 404));
    }

    if (session.submissionStatus !== 'evaluated' || !session.result) {
        return next(
            new ApiError(
                `Results are not yet available. Current status: ${session.submissionStatus}`,
                404,
            ),
        );
    }

    res.status(200).json({
        success: true,
        data: session.result,
    });
});

export default router;
