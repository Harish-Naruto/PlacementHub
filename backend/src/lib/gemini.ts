import config from '../config';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GEMINI_BASE_URL =
    'https://generativelanguage.googleapis.com/v1beta/models';

/** HTTP status codes that are safe to retry. */
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

// ---------------------------------------------------------------------------
// Model accessor (lazy-read so env var is resolved at call-time)
// ---------------------------------------------------------------------------

export function getGeminiModel(): string {
    return config.geminiModel;
}

// ---------------------------------------------------------------------------
// Core fetch wrapper with exponential-backoff retry
// ---------------------------------------------------------------------------

/**
 * Calls the Gemini REST API directly (no SDK dependency).
 * Retries on transient failures using exponential back-off.
 *
 * @param prompt   The text prompt to send.
 * @param maxTries Total attempts including the first one (default 4).
 * @param baseMs   Initial delay in ms before first retry (default 1000).
 */
export async function callGemini(
    prompt: string,
    maxTries = 4,
    baseMs = 1000,
): Promise<string> {
    const apiKey = config.geminiApiKey();
    const model = getGeminiModel();
    const url = `${GEMINI_BASE_URL}/${model}:generateContent`;

    let lastError: unknown;

    for (let attempt = 0; attempt < maxTries; attempt++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey,
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [{ text: prompt }],
                        },
                    ],
                }),
            });

            const data = (await response.json()) as {
                candidates?: Array<{
                    content?: { parts?: Array<{ text?: string }> };
                }>;
                error?: { message?: string; code?: number };
            };

            if (response.ok) {
                const text =
                    data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
                return text;
            }

            // Non-retryable client errors — throw immediately
            if (!RETRYABLE_STATUS_CODES.has(response.status)) {
                const msg =
                    data.error?.message ??
                    `Gemini API error: HTTP ${response.status}`;
                throw new Error(msg);
            }

            // Retryable — save error and fall through to delay
            lastError = new Error(
                data.error?.message ?? `Gemini transient error: HTTP ${response.status}`,
            );
        } catch (err) {
            // Network-level errors are always retryable
            if (err instanceof TypeError) {
                lastError = err;
            } else {
                // Non-retryable errors re-thrown immediately
                throw err;
            }
        }

        if (attempt < maxTries - 1) {
            const delayMs = baseMs * 2 ** attempt;
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }

    throw lastError ?? new Error('Gemini API call failed after all retries.');
}

// ---------------------------------------------------------------------------
// JSON extraction helper
// ---------------------------------------------------------------------------

/**
 * Parses a JSON block from a Gemini response.
 * Gemini sometimes wraps JSON in ```json … ``` fences — this strips them.
 */
export function extractJSON<T>(raw: string): T {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = fenced ? fenced[1] : raw;
    return JSON.parse(jsonStr.trim()) as T;
}
