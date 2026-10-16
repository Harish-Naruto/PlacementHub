import { describe, expect, test } from 'bun:test';
import { classifyGeminiError } from '../src/lib/gemini';
import { generateAssessment } from '../src/services/assessmentGenerator.service';
import sample from '../resumeparser.output.json';

describe('Gemini Error Classification & Retry Strategy', () => {
    test('1. Invalid API key is identified as non-retryable INVALID_API_KEY', () => {
        const err = {
            status: 400,
            message: 'API key not valid. Please pass a valid API key. [API_KEY_INVALID]',
        };
        const classified = classifyGeminiError(err);
        expect(classified.kind).toBe('INVALID_API_KEY');
        expect(classified.retryable).toBe(false);
        expect(classified.status).toBe(400);
    });

    test('2. Timeout (AbortError / operation aborted) is identified as retryable TIMEOUT', () => {
        const err = new Error('The operation was aborted.');
        err.name = 'AbortError';
        const classified = classifyGeminiError(err);
        expect(classified.kind).toBe('TIMEOUT');
        expect(classified.retryable).toBe(true);
        expect(classified.status).toBe(504);
    });

    test('3. Rate limit (429) is identified as retryable RATE_LIMITED and parses Retry-After', () => {
        const err = {
            status: 429,
            message: 'Resource has been exhausted (e.g. check quota).',
            response: {
                headers: {
                    get: (header: string) => (header === 'retry-after' ? '5' : null),
                },
            },
        };
        const classified = classifyGeminiError(err);
        expect(classified.kind).toBe('RATE_LIMITED');
        expect(classified.retryable).toBe(true);
        expect(classified.status).toBe(429);
        expect(classified.retryAfterSeconds).toBe(5);
    });

    test('4. Upstream 503/504 errors are identified as retryable UPSTREAM_UNAVAILABLE', () => {
        const err503 = { status: 503, message: 'The model is overloaded. Please try again later.' };
        const classified503 = classifyGeminiError(err503);
        expect(classified503.kind).toBe('UPSTREAM_UNAVAILABLE');
        expect(classified503.retryable).toBe(true);
        expect(classified503.status).toBe(503);
    });

    test('5. Network errors (fetch failed) are identified as retryable NETWORK_ERROR', () => {
        const err = new TypeError('fetch failed: connect ECONNREFUSED 127.0.0.1:443');
        const classified = classifyGeminiError(err);
        expect(classified.kind).toBe('NETWORK_ERROR');
        expect(classified.retryable).toBe(true);
    });

    test('6. Malformed JSON or SyntaxError is identified as retryable INVALID_OUTPUT', () => {
        const err = new SyntaxError('Unexpected token < in JSON at position 0');
        const classified = classifyGeminiError(err);
        expect(classified.kind).toBe('INVALID_OUTPUT');
        expect(classified.retryable).toBe(true);
    });

    test('7. API key is never leaked in classified messages', () => {
        const fakeKey = 'AIzaSyD-1234567890abcdefghijklmnopqrst';
        const err = new Error(`Failed with key ${fakeKey}`);
        const classified = classifyGeminiError(err);
        expect(classified.message).not.toContain(fakeKey);
        expect(classified.message).toContain('[REDACTED_KEY]');
    });
});
