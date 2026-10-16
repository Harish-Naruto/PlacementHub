import { Router, Request, Response, NextFunction } from 'express';
import { getAllMockResumes, getMockResumeById } from '../data/mockResumes';
import { ApiError } from '../utils/apiError';

const router = Router();

/**
 * GET /api/v1/mock/resumes
 * Returns a list of all mock resume profiles (email redacted).
 */
router.get('/', (_req: Request, res: Response) => {
    const resumes = getAllMockResumes();
    res.status(200).json({
        success: true,
        count: resumes.length,
        data: resumes,
        _note: 'These are DUMMY TEST PROFILES for demonstration only.',
    });
});

/**
 * GET /api/v1/mock/resumes/:id
 * Returns a single mock resume by ID.
 */
router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const resume = getMockResumeById(id);

    if (!resume) {
        return next(new ApiError(`Resume with id "${id}" not found`, 404));
    }

    // Omit internal email for the public response
    const { email: _email, ...publicResume } = resume;

    res.status(200).json({
        success: true,
        data: publicResume,
        _note: 'DUMMY TEST PROFILE for demonstration only.',
    });
});

export default router;
