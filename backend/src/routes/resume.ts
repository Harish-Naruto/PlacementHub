import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import config from '../config/index.ts';
import prisma from '../config/prisma.ts';
import { authenticate } from '../middleware/authenticate.ts';
import { verifyGithub } from '../github/verify.ts';
import { extractText } from '../resume/extractText.ts';
import { parseResume } from '../resume/parseResume.ts';
import type { ParsedResume } from '../resume/schema.ts';
import { ApiError } from '../utils/apiError.ts';

// Assessment generator and GitHub verifier should call this instead of re-parsing the file.
export async function getParsedResume(id: string): Promise<ParsedResume | null> {
    const row = await prisma.parsedResume.findUnique({ where: { id } });
    return row ? (row.data as unknown as ParsedResume) : null;
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.resumeMaxBytes, files: 1 } });

const handleUpload = (req: Request, res: Response, next: NextFunction) =>
    upload.single('resume')(req, res, (err) => {
        if (!err) return next();
        const tooBig = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE';
        next(
            new ApiError(
                tooBig ? 'Resume file is too large (max 5MB)' : 'Invalid upload',
                tooBig ? 413 : 400,
                true,
                tooBig ? 'FILE_TOO_LARGE' : 'BAD_UPLOAD',
            ),
        );
    });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Owner or recruiter only; everything else looks like "not found".
async function loadAccessibleResume(req: Request) {
    const id = req.params.id as string;
    const row = UUID.test(id) ? await prisma.parsedResume.findUnique({ where: { id } }) : null;
    if (!row || (row.userId !== req.user!.id && req.user!.role !== 'RECRUITER')) {
        throw new ApiError('Resume not found', 404, true, 'NOT_FOUND');
    }
    return row;
}

const router = Router();
router.use(authenticate);

// POST /api/v1/resumes  (multipart form field: "resume")
router.post('/', handleUpload, async (req, res, next) => {
    try {
        if (!req.file) throw new ApiError('Upload a resume in the "resume" field', 400, true, 'NO_FILE');
        const text = await extractText(req.file.buffer);
        const parsed = await parseResume(text);

        let row;
        try {
            row = await prisma.parsedResume.create({
                data: { userId: req.user!.id, schemaVersion: parsed.schema_version, data: parsed as object },
            });
        } catch {
            throw new ApiError('Could not save the parsed resume', 500, true, 'SAVE_FAILED');
        }
        res.status(201).json({ error: false, data: { id: row.id, resume: parsed } });
    } catch (e) {
        next(e);
    }
});

// GET /api/v1/resumes/:id  (owner or recruiter)
router.get('/:id', async (req, res, next) => {
    try {
        const row = await loadAccessibleResume(req);
        res.json({ error: false, data: { id: row.id, resume: row.data, createdAt: row.createdAt } });
    } catch (e) {
        next(e);
    }
});

// Each run makes many GitHub API calls, so it gets its own, tighter limit (per user).
const githubLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id ?? 'anonymous',
    validate: { keyGeneratorIpFallback: false },
    message: { error: true, message: 'Too many GitHub verifications; please wait and try again', code: 'RATE_LIMITED' },
});

const githubBody = z.object({ githubUsername: z.string().trim().min(1).max(200).optional() });

// POST /api/v1/resumes/:id/github-verification  (owner or recruiter)
// Body (optional): { "githubUsername": "octocat" | "https://github.com/octocat" }
// Secondary evidence only: returns a report and never touches assessment scores.
router.post('/:id/github-verification', githubLimiter, async (req, res, next) => {
    try {
        const row = await loadAccessibleResume(req);
        const body = githubBody.safeParse(req.body ?? {});
        if (!body.success) throw new ApiError('Invalid request body', 400, true, 'INVALID_BODY');

        const profile = await prisma.studentProfile.findUnique({ where: { userId: row.userId }, select: { githubUsername: true } });
        const report = await verifyGithub({
            resume: row.data as unknown as ParsedResume,
            username: body.data.githubUsername,
            profileUsername: profile?.githubUsername,
        });
        res.json({ error: false, data: report });
    } catch (e) {
        next(e);
    }
});

export default router;
