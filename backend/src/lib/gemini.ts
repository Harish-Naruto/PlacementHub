import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import config from '../config';
import { ApiError } from '../utils/apiError';

// ---------------------------------------------------------------------------
// Google Gemini API Integration for Assessment Generation & Grading
//
// Performance & Reliability Controls:
//   - Structured JSON output enforced via responseMimeType & responseJsonSchema
//   - Disabled thinking on 2.5-flash models to avoid multi-second deliberation overhead
//   - Explicit SDK request timeout via httpOptions.timeout (default 35s)
//   - Internal SDK retry disabled (retryOptions: { attempts: 1 }) to keep retries bounded
//   - Exponential backoff with jitter for transient errors (429, 503, network, timeout)
//   - Immediate non-retryable failure for invalid API keys or client errors
//   - Detailed sanitized timing logs without sensitive key or prompt data
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 35_000;
const DEFAULT_ATTEMPTS = 2;
const BASE_RETRY_DELAY_MS = 1000;

let client: GoogleGenAI | undefined;

function getClient(): GoogleGenAI {
    client ??= new GoogleGenAI({ apiKey: config.geminiApiKey() });
    return client;
}

export type GeminiErrorKind =
    | 'INVALID_API_KEY'
    | 'MODEL_NOT_FOUND'
    | 'RATE_LIMITED'
    | 'TIMEOUT'
    | 'UPSTREAM_UNAVAILABLE'
    | 'NETWORK_ERROR'
    | 'INVALID_OUTPUT'
    | 'UNKNOWN';

export interface ClassifiedError {
    kind: GeminiErrorKind;
    status?: number;
    message: string;
    retryable: boolean;
    retryAfterSeconds?: number;
}

/**
 * Inspects and sanitizes Gemini errors, distinguishing permanent from transient failures.
 * Never exposes or logs the API key.
 */
export function classifyGeminiError(err: unknown): ClassifiedError {
    if (!err) {
        return { kind: 'UNKNOWN', message: 'Unknown error', retryable: false };
    }

    const errObj = err as {
        status?: number;
        statusCode?: number;
        name?: string;
        message?: string;
        code?: string | number;
        response?: { headers?: { get?: (k: string) => string | null } };
    };

    const status = typeof errObj.status === 'number'
        ? errObj.status
        : typeof errObj.statusCode === 'number'
            ? errObj.statusCode
            : undefined;

    const rawMessage = typeof errObj.message === 'string' ? errObj.message : String(err);
    // Sanitize any key-like strings from message (never leak keys in logs or errors)
    const sanitizedMsg = rawMessage
        .replace(/AIza[0-9A-Za-z\-_]{30,45}/g, '[REDACTED_KEY]')
        .replace(/AQ\.[0-9A-Za-z\-_]{30,60}/g, '[REDACTED_KEY]')
        .slice(0, 300);
    const lowerMsg = sanitizedMsg.toLowerCase();

    // 1. Invalid API Key
    if (
        status === 401 ||
        status === 403 ||
        (status === 400 && (lowerMsg.includes('api_key_invalid') || lowerMsg.includes('api key not valid') || lowerMsg.includes('invalid api key')))
    ) {
        return {
            kind: 'INVALID_API_KEY',
            status: status || 401,
            message: 'Invalid Gemini API key. Please verify your GEMINI_API_KEY configuration.',
            retryable: false,
        };
    }

    // 2. Model Not Found
    if (status === 404 && lowerMsg.includes('not found')) {
        return {
            kind: 'MODEL_NOT_FOUND',
            status: 404,
            message: sanitizedMsg,
            retryable: false,
        };
    }

    // 3. Local or Upstream Timeout
    if (
        errObj.name === 'AbortError' ||
        errObj.name === 'TimeoutError' ||
        status === 408 ||
        status === 504 ||
        lowerMsg.includes('timeout') ||
        lowerMsg.includes('aborted') ||
        lowerMsg.includes('deadline exceeded')
    ) {
        return {
            kind: 'TIMEOUT',
            status: status || 504,
            message: 'Gemini request timed out.',
            retryable: true,
        };
    }

    // 4. Rate Limited / Quota Exceeded (429)
    if (status === 429 || lowerMsg.includes('resource_exhausted') || lowerMsg.includes('rate limit')) {
        let retryAfter: number | undefined;
        try {
            const h = errObj.response?.headers?.get?.('retry-after');
            if (h) retryAfter = parseInt(h, 10);
        } catch {
            // ignore header parse error
        }
        return {
            kind: 'RATE_LIMITED',
            status: 429,
            message: 'Gemini API quota or rate limit exceeded.',
            retryable: true,
            retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : undefined,
        };
    }

    // 5. Upstream Unavailable (500, 502, 503)
    if (status && status >= 500) {
        return {
            kind: 'UPSTREAM_UNAVAILABLE',
            status,
            message: `Gemini service error (HTTP ${status}).`,
            retryable: true,
        };
    }

    // 6. Network failure / connection reset
    if (
        lowerMsg.includes('fetch failed') ||
        lowerMsg.includes('econnrefused') ||
        lowerMsg.includes('enotfound') ||
        lowerMsg.includes('network')
    ) {
        return {
            kind: 'NETWORK_ERROR',
            message: 'Network connection to Gemini API failed.',
            retryable: true,
        };
    }

    // 7. Schema / Parsing error
    if (err instanceof SyntaxError || err instanceof z.ZodError) {
        return {
            kind: 'INVALID_OUTPUT',
            message: err instanceof z.ZodError ? `Schema validation failed: ${err.issues[0]?.message}` : 'Model returned malformed JSON.',
            retryable: true,
        };
    }

    return {
        kind: 'UNKNOWN',
        status,
        message: sanitizedMsg,
        retryable: false,
    };
}

export interface GenerateJSONOptions<T> {
    prompt: string;
    schema: z.ZodType<T>;
    /** Stable instructions kept apart from the (untrusted) data in `prompt`. */
    systemInstruction?: string;
    timeoutMs?: number;
    /** Total attempts including the first one. */
    attempts?: number;
    temperature?: number;
    maxOutputTokens?: number;
    model?: string;
}

/**
 * Generate structured JSON validated against a Zod schema using Google Gemini.
 */
export async function generateJSON<T>(opts: GenerateJSONOptions<T>): Promise<T> {
    const {
        prompt,
        schema,
        systemInstruction,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        attempts = DEFAULT_ATTEMPTS,
        temperature = 0.2,
        maxOutputTokens = 3500,
        model = config.geminiModel,
    } = opts;

    const ai = getClient();
    const responseJsonSchema = z.toJSONSchema(schema);
    const disableThinking = /2\.5-flash/.test(model);

    let lastError: ClassifiedError | undefined;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        const started = Date.now();
        console.info(`[gemini] Starting request with model "${model}" (attempt ${attempt}/${attempts}, timeout ${timeoutMs}ms)`);

        try {
            const res = await ai.models.generateContent({
                model,
                contents: prompt,
                config: {
                    systemInstruction,
                    responseMimeType: 'application/json',
                    responseJsonSchema,
                    temperature,
                    maxOutputTokens,
                    ...(disableThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
                    httpOptions: {
                        timeout: timeoutMs,
                        retryOptions: { attempts: 1 },
                    },
                },
            });

            const rawText = res.text ?? '';
            const elapsed = Date.now() - started;

            let parsedObj: unknown;
            try {
                parsedObj = JSON.parse(rawText);
            } catch (syntaxErr) {
                console.warn(`[gemini] JSON.parse failed on model output after ${elapsed}ms:`, (syntaxErr as Error).message);
                throw syntaxErr;
            }

            const validated = schema.parse(parsedObj);
            console.info(`[gemini] Success with "${model}" in ${elapsed}ms (attempt ${attempt})`);
            return validated;
        } catch (err) {
            const elapsed = Date.now() - started;
            const classified = classifyGeminiError(err);
            lastError = classified;

            console.warn(
                `[gemini] "${model}" attempt ${attempt}/${attempts} failed after ${elapsed}ms: ` +
                `kind=${classified.kind} status=${classified.status ?? 'N/A'} message="${classified.message}" retryable=${classified.retryable}`
            );

            // Never retry non-retryable errors (invalid API key, 404, bad argument)
            if (!classified.retryable || attempt >= attempts) {
                break;
            }

            // Exponential backoff with jitter
            let backoffMs = Math.min(
                BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 500),
                8000
            );
            if (classified.retryAfterSeconds && classified.retryAfterSeconds > 0) {
                backoffMs = Math.min(classified.retryAfterSeconds * 1000, 10000);
            }

            console.info(`[gemini] Waiting ${backoffMs}ms before retry attempt ${attempt + 1}...`);
            await new Promise((r) => setTimeout(r, backoffMs));
        }
    }

    // Map classified error to appropriate HTTP status and user-facing message
    if (lastError?.kind === 'INVALID_API_KEY') {
        throw new ApiError('Invalid Gemini API Key. Please verify your GEMINI_API_KEY configuration in backend/.env', 401, true, 'INVALID_GEMINI_API_KEY');
    }
    if (lastError?.kind === 'RATE_LIMITED') {
        throw new ApiError('The Gemini AI service is currently busy or rate-limited; please try again in a moment', 429, true, 'LLM_RATE_LIMITED');
    }
    if (lastError?.kind === 'TIMEOUT') {
        throw new ApiError('The Gemini AI generation timed out. Please try again with fewer questions or check your connection.', 504, true, 'LLM_TIMEOUT');
    }
    if (lastError?.kind === 'INVALID_OUTPUT') {
        throw new ApiError('The AI returned an unusable response structure; please try again', 502, true, 'INVALID_LLM_OUTPUT');
    }
    if (lastError?.kind === 'NETWORK_ERROR') {
        throw new ApiError('Failed to connect to the Gemini AI service. Please check your network connection.', 503, true, 'LLM_NETWORK_ERROR');
    }

    throw new ApiError(
        lastError?.message || 'The Gemini AI service is unavailable; please try again',
        lastError?.status && lastError.status >= 400 && lastError.status < 600 ? lastError.status : 503,
        true,
        'LLM_UNAVAILABLE'
    );
}
