import express from 'express';
import { json, urlencoded } from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import config from './config';
import { errorHandler } from './utils/apiError';
import routes from './routes';

const app = express();

const limiter = rateLimit({
    windowMs: config.rate_limit_window_minutes() * 60 * 1000,
    max: config.rate_limit_max_request(),
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(
    cors({
        origin: config.allowed_origins,
        methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        credentials: true,
    }),
);

app.use(helmet());
app.use(limiter);
app.use(cookieParser());
app.use(json());
app.use(urlencoded({ extended: true }));

app.use('/api/v1', routes());

app.get('/health', (_req, res) => {
    res.status(200).json({ message: 'OK' });
});

app.use((_req, res) => {
    res.status(404).json({ message: 'Not Found' });
});

app.use(errorHandler);

export default app;
