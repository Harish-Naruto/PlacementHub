const validateEnvVar = (name: string, value: string | undefined): string => {
    if (!value) {
        throw new Error(`${name} is not defined in environment variables`);
    }
    return value;
};

export default {
    port: process.env.PORT || 3000,
    allowed_origins: process.env.ALLOWED_ORIGINS || '*',
    rate_limit_window_minutes: () => {
        if (!process.env.RATE_LIMIT_WINDOW_MINUTES) return 15;
        return parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES);
    },
    rate_limit_max_request: () => {
        if (!process.env.RATE_LIMIT_MAX_REQUESTS) return 100;
        return parseInt(process.env.RATE_LIMIT_MAX_REQUESTS);
    },
};
