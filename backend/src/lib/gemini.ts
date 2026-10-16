import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import config from '../config';
import { ApiError } from '../utils/apiError';

// ---------------------------------------------------------------------------
// Single entry point for every structured Gemini call in the assessment feature.
//
// Latency / cost controls:
//   - Structured output (responseMimeType + responseJsonSchema): no fenced or
//     malformed JSON, so no "retry because the JSON was garbage" loops.
//   - Thinking is disabled on 2.5-flash models: it adds many seconds for tasks
//     (question writing, rubric grading) that do not need it.
//   - A hard per-request timeout, so a stalled request can never hang the API.
//   - The SDK's own retry (default: 5 attempts, up to 60s back-off) is switched
//     off; this module is the only retry layer and it is bounded.
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 40_000;
const DEFAULT_ATTEMPTS = 2;
const RETRY_DELAY_MS = 800;
// A healthy flash model answers in a few seconds; past this the primary is treated as down.
const PRIMARY_TIMEOUT_MS = 15_000;
const PRIMARY_COOLDOWN_MS = 2 * 60_000;

let primaryDownUntil = 0;

let client: GoogleGenAI | undefined;

function getClient(): GoogleGenAI {
    client ??= new GoogleGenAI({ apiKey: config.geminiApiKey() });
    return client;
}

function statusOf(err: unknown): number | undefined {
    const status = (err as { status?: number })?.status;
    return typeof status === 'number' ? status : undefined;
}

/** Network errors, timeouts, rate limits and 5xx are worth one more try; other 4xx are not. */
function isTransient(err: unknown): boolean {
    const status = statusOf(err);
    return status === undefined || status === 408 || status === 429 || status >= 500;
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
}

export async function generateJSON<T>(opts: GenerateJSONOptions<T>): Promise<T> {
    const {
        prompt,
        schema,
        systemInstruction,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        attempts = DEFAULT_ATTEMPTS,
        temperature = 0.4,
    } = opts;

    const ai = getClient();
    const responseJsonSchema = z.toJSONSchema(schema);

    const primary = config.geminiModel;
    const fallback = config.geminiFallbackModel;

    let lastError: unknown;
    let previousModel: string | undefined;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        // An overloaded/hung primary is not worth retrying: go to the fallback, and keep
        // using it for a while so later requests do not each pay the primary's timeout.
        const model = attempt === 1 && Date.now() >= primaryDownUntil ? primary : fallback;
        const isPrimary = model === primary && primary !== fallback;
        const disableThinking = /2\.5-flash/.test(model);
        const started = Date.now();
        if (previousModel === model) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        previousModel = model;
        try {
            const res = await ai.models.generateContent({
                model,
                contents: prompt,
                config: {
                    systemInstruction,
                    responseMimeType: 'application/json',
                    responseJsonSchema,
                    temperature,
                    ...(disableThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
                    httpOptions: {
                        timeout: isPrimary ? Math.min(timeoutMs, PRIMARY_TIMEOUT_MS) : timeoutMs,
                        retryOptions: { attempts: 1 },
                    },
                },
            });
            const parsed = schema.parse(JSON.parse(res.text ?? ''));
            console.info(`[gemini] ${model} ok in ${Date.now() - started}ms (attempt ${attempt})`);
            return parsed;
        } catch (err) {
            lastError = err;
            console.warn(`[gemini] ${model} failed after ${Date.now() - started}ms:`, (err as Error)?.name, statusOf(err) ?? '');
            if (isPrimary && isTransient(err)) primaryDownUntil = Date.now() + PRIMARY_COOLDOWN_MS;
            const retryable = err instanceof SyntaxError || err instanceof z.ZodError || isTransient(err);
            if (!retryable) break;
        }
    }

    // Logs above include only error type/status; prompts contain resume and answer text.
    if (lastError instanceof SyntaxError || lastError instanceof z.ZodError) {
        throw new ApiError('The AI returned an unusable response; please try again', 502, true, 'INVALID_LLM_OUTPUT');
    }
    if (statusOf(lastError) === 429) {
        throw new ApiError('The AI service is busy; please try again in a minute', 503, true, 'LLM_RATE_LIMITED');
    }
    throw new ApiError('The AI service is unavailable; please try again', 503, true, 'LLM_UNAVAILABLE');
}
