import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { generateAssessment } from '../services/assessmentGenerator.service';
import { evaluateAssessment } from '../services/assessmentEvaluator.service';
import { sessionStore, SESSION_TTL_MS } from '../store/sessionStore';
import {
    AssessmentConfigSchema,
    AssessmentSession,
    SubmitAssessmentBodySchema,
    toPublicQuestion,
} from '../types/assessment';
import { authenticate } from '../middleware/authenticate';
import { ApiError } from '../utils/apiError';

const router = Router();
router.use(authenticate);

// Generation and grading are the only routes that spend Gemini quota.
const aiLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 15,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user!.id,
    validate: { keyGeneratorIpFallback: false },
    message: { error: true, message: 'Too many assessment requests; please wait a few minutes' },
});

/** Returns the caller's session. Someone else's session looks the same as a missing one. */
function getOwnedSession(req: Request): AssessmentSession {
    const id = req.params.assessmentId as string;
    const session = sessionStore.get(id);
    if (!session || session.userId !== req.user!.id) {
        throw new ApiError(`Assessment "${id}" not found or has expired`, 404);
    }
    return session;
}

// ---------------------------------------------------------------------------
// POST /api/v1/assessments/generate
// ---------------------------------------------------------------------------

const GenerateBodySchema = z.object({
    resumeId: z.string().min(1).max(64),
    config: AssessmentConfigSchema.optional(),
});

router.post('/generate', aiLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const parsed = GenerateBodySchema.safeParse(req.body);
        if (!parsed.success) {
            return next(new ApiError(`Invalid request body: ${parsed.error.message}`, 400));
        }

        const { resumeId } = parsed.data;
        const config = AssessmentConfigSchema.parse(parsed.data.config ?? {});
        const userId = req.user!.id;

        const privateAssessment = await generateAssessment(resumeId, userId, config);

        const assessmentId = `asmnt_${randomUUID()}`;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
        const publicQuestions = privateAssessment.questions.map(toPublicQuestion);

        sessionStore.set({
            assessmentId,
            userId,
            resumeId,
            config,
            privateAssessment,
            publicQuestions,
            createdAt: now,
            expiresAt,
            submissionStatus: 'pending',
        });

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
    try {
        const session = getOwnedSession(req);
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
    } catch (err) {
        next(err);
    }
});

// ---------------------------------------------------------------------------
// POST /api/v1/assessments/:assessmentId/submit
// ---------------------------------------------------------------------------

router.post('/:assessmentId/submit', aiLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const session = getOwnedSession(req);

        // 'submitted' means an evaluation is in flight; 'evaluated' means done.
        if (session.submissionStatus === 'submitted' || session.submissionStatus === 'evaluated') {
            return next(
                new ApiError(
                    `Assessment "${session.assessmentId}" has already been submitted (status: ${session.submissionStatus})`,
                    409,
                ),
            );
        }

        const parsed = SubmitAssessmentBodySchema.safeParse(req.body);
        if (!parsed.success) {
            return next(new ApiError(`Invalid submission body: ${parsed.error.message}`, 400));
        }

        // Claim the session synchronously (before any await) so a double-click cannot grade twice.
        sessionStore.update(session.assessmentId, { submissionStatus: 'submitted', submittedAt: new Date() });

        try {
            const result = await evaluateAssessment(session, parsed.data.answers);
            sessionStore.update(session.assessmentId, { submissionStatus: 'evaluated', result });
            res.status(200).json({ success: true, data: result });
        } catch (evalErr) {
            // Grading failed (Gemini down, etc.): let the student retry instead of locking the session.
            sessionStore.update(session.assessmentId, { submissionStatus: 'pending', submittedAt: undefined });
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
    try {
        const session = getOwnedSession(req);
        if (session.submissionStatus !== 'evaluated' || !session.result) {
            throw new ApiError(`Results are not yet available. Current status: ${session.submissionStatus}`, 404);
        }
        res.status(200).json({ success: true, data: session.result });
    } catch (err) {
        next(err);
    }
});

export default router;
