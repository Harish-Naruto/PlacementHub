import { Router } from 'express';

export default function routes() {
    const router = Router();

    router.get('/ping', (_req, res) => {
        res.status(200).json({ message: 'pong', status: 'API is working' });
    });

    return router;
}