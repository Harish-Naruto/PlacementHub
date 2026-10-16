import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import config from '../config/index.ts';
import prisma from '../config/prisma.ts';
import { authenticate } from '../middleware/authenticate.ts';
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
        const id = req.params.id as string;
        const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const row = uuid.test(id) ? await prisma.parsedResume.findUnique({ where: { id } }) : null;
        if (!row || (row.userId !== req.user!.id && req.user!.role !== 'RECRUITER')) {
            throw new ApiError('Resume not found', 404, true, 'NOT_FOUND');
        }
        res.json({ error: false, data: { id: row.id, resume: row.data, createdAt: row.createdAt } });
    } catch (e) {
        next(e);
    }
});

export default router;
