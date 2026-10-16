// Dummy values so config validation passes in unit tests (real values come from .env).
const defaults: Record<string, string> = {
    JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-1234',
    RECRUITER_SIGNUP_CODE: 'test',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    GEMINI_API_KEY: 'test',
};
for (const [k, v] of Object.entries(defaults)) process.env[k] ??= v;
