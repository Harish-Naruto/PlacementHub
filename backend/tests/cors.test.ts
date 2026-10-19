import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';
import { isOriginAllowed, parseOrigins } from '../src/utils/cors';

describe('origin rules', () => {
    test('FRONTEND_URL can hold several origins; spaces and trailing slashes are ignored', () => {
        expect(parseOrigins('https://placement.example.com/, https://admin.example.com')).toEqual(['https://placement.example.com', 'https://admin.example.com']);
        expect(parseOrigins(undefined)).toEqual(['http://localhost:5173']);
        expect(parseOrigins('')).toEqual(['http://localhost:5173']);
    });

    const allowed = parseOrigins('https://placement.example.com/');

    test('a listed origin is allowed in production and development', () => {
        expect(isOriginAllowed('https://placement.example.com', allowed, true)).toBe(true);
        expect(isOriginAllowed('https://placement.example.com', allowed, false)).toBe(true);
    });

    test('in development any localhost port is allowed (Vite moves to 5174 when 5173 is busy)', () => {
        for (const o of ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://localhost']) {
            expect(isOriginAllowed(o, allowed, false)).toBe(true);
        }
    });

    test('in production localhost is not allowed unless listed', () => {
        expect(isOriginAllowed('http://localhost:5174', allowed, true)).toBe(false);
        expect(isOriginAllowed('http://localhost:5174', parseOrigins('http://localhost:5174'), true)).toBe(true);
    });

    test('unknown origins and look-alikes are refused', () => {
        expect(isOriginAllowed('https://evil.example.org', allowed, false)).toBe(false);
        expect(isOriginAllowed('https://placement.example.com.evil.org', allowed, false)).toBe(false);
        expect(isOriginAllowed('http://localhost.evil.org', allowed, false)).toBe(false);
    });

    test('no Origin header (curl, same-origin) is allowed', () => {
        expect(isOriginAllowed(undefined, allowed, true)).toBe(true);
    });
});

// The real app, like a browser would call it. Uses whatever FRONTEND_URL the environment has.
describe('CORS on the real app', () => {
    let server: Server;
    let base = '';
    let configured = '';

    beforeAll(async () => {
        const { default: config } = await import('../src/config/index.ts');
        configured = config.allowedOrigins[0]!;
        const { default: app } = await import('../src/app.ts');
        await new Promise<void>((resolve) => {
            server = app.listen(0, '127.0.0.1', () => resolve());
        });
        const addr = server.address();
        base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}/api/v1`;
    });

    afterAll(() => {
        server?.close();
    });

    const preflight = (origin: string) =>
        fetch(`${base}/auth/login`, {
            method: 'OPTIONS',
            headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,authorization' },
        });

    test('the configured frontend origin passes the preflight with credentials and the Authorization header', async () => {
        const res = await preflight(configured);
        expect(res.headers.get('access-control-allow-origin')).toBe(configured);
        expect(res.headers.get('access-control-allow-credentials')).toBe('true');
        expect(res.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('authorization');
    });

    test('an unknown origin gets no CORS headers', async () => {
        expect((await preflight('https://evil.example.org')).headers.get('access-control-allow-origin')).toBeNull();
    });

    test('a request without an Origin still works', async () => {
        expect((await fetch(`${base}/health`)).status).toBe(200);
    });
});
