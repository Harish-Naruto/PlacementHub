import config from '../config/index.ts';

export type GithubErrorKind =
    | 'not_found'
    | 'forbidden'
    | 'rate_limited'
    | 'budget_exhausted'
    | 'timeout'
    | 'network'
    | 'unexpected';

export class GithubError extends Error {
    constructor(
        public kind: GithubErrorKind,
        public status?: number,
        message?: string,
    ) {
        super(message ?? kind);
        this.name = 'GithubError';
    }
}

export interface GithubClientOptions {
    token?: string;
    fetch?: typeof fetch;
    timeoutMs?: number;
    maxRequests?: number; // per client instance (one verification run)
    cacheTtlMs?: number;
    baseUrl?: string;
}

// Responses are cached across runs; key never contains the token.
const CACHE_MAX = 500;
const cache = new Map<string, { at: number; value: unknown }>();

export const clearGithubCache = () => cache.clear();

const RETRIES = 2;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const encodePath = (p: string) => p.split('/').map(encodeURIComponent).join('/');

// Thin GitHub REST wrapper: timeouts, bounded retries, bounded pagination, a per-run request budget
// and distinct errors for 404 / 403 / rate limits. Credentials stay on the server.
export class GithubClient {
    private used = 0;
    private readonly fetchFn: typeof fetch;
    private readonly token?: string;
    private readonly timeoutMs: number;
    private readonly maxRequests: number;
    private readonly cacheTtlMs: number;
    private readonly baseUrl: string;

    constructor(opts: GithubClientOptions = {}) {
        this.fetchFn = opts.fetch ?? fetch;
        this.token = opts.token ?? config.githubToken;
        this.timeoutMs = opts.timeoutMs ?? config.githubTimeoutMs;
        this.maxRequests = opts.maxRequests ?? config.githubMaxRequests;
        this.cacheTtlMs = opts.cacheTtlMs ?? 5 * 60_000;
        this.baseUrl = opts.baseUrl ?? 'https://api.github.com';
    }

    get requestsUsed() {
        return this.used;
    }

    private async request(path: string, accept: string): Promise<Response> {
        const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
        let lastErr: GithubError | undefined;

        for (let attempt = 0; attempt <= RETRIES; attempt++) {
            if (this.used >= this.maxRequests) {
                throw new GithubError('budget_exhausted', undefined, 'GitHub request budget for this run was exhausted');
            }
            this.used++;

            let res: Response;
            try {
                res = await this.fetchFn(url, {
                    headers: {
                        Accept: accept,
                        'X-GitHub-Api-Version': '2022-11-28',
                        'User-Agent': 'call-of-code-resume-verifier',
                        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
                    },
                    signal: AbortSignal.timeout(this.timeoutMs),
                });
            } catch (e) {
                const timedOut = (e as Error)?.name === 'TimeoutError' || (e as Error)?.name === 'AbortError';
                lastErr = new GithubError(timedOut ? 'timeout' : 'network');
                if (attempt < RETRIES) await sleep(300 * 2 ** attempt);
                continue;
            }

            if (res.ok) return res;
            if (res.status === 404 || res.status === 410) throw new GithubError('not_found', res.status);
            if (res.status === 429 || (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0')) {
                throw new GithubError('rate_limited', res.status);
            }
            if (res.status === 401 || res.status === 403) throw new GithubError('forbidden', res.status);
            if (res.status >= 500) {
                lastErr = new GithubError('unexpected', res.status);
                if (attempt < RETRIES) await sleep(300 * 2 ** attempt);
                continue;
            }
            throw new GithubError('unexpected', res.status);
        }
        throw lastErr ?? new GithubError('unexpected');
    }

    private cached<T>(key: string): T | undefined {
        const hit = cache.get(key);
        if (hit && Date.now() - hit.at < this.cacheTtlMs) return hit.value as T;
        cache.delete(key);
        return undefined;
    }

    private store(key: string, value: unknown) {
        if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
        cache.set(key, { at: Date.now(), value });
    }

    async json<T>(path: string): Promise<T> {
        const key = `json:${path}`;
        const hit = this.cached<T>(key);
        if (hit !== undefined) return hit;
        const res = await this.request(path, 'application/vnd.github+json');
        const value = (await res.json()) as T;
        this.store(key, value);
        return value;
    }

    // Follows Link rel="next" for at most maxPages pages; returns whether more pages existed.
    async paged<T>(path: string, maxPages: number): Promise<{ items: T[]; truncated: boolean }> {
        const items: T[] = [];
        let next: string | null = `${path}${path.includes('?') ? '&' : '?'}per_page=100`;
        for (let page = 0; next && page < maxPages; page++) {
            const key = `json:${next}`;
            let body = this.cached<T[]>(key);
            let link: string | null = null;
            if (body === undefined) {
                const res = await this.request(next, 'application/vnd.github+json');
                body = (await res.json()) as T[];
                link = res.headers.get('link');
                this.store(key, body);
                this.store(`link:${next}`, link);
            } else {
                link = this.cached<string | null>(`link:${next}`) ?? null;
            }
            if (Array.isArray(body)) items.push(...body);
            next = link?.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
        }
        return { items, truncated: next !== null };
    }

    // Raw file text at a specific commit. Caller must already know the file is small enough.
    async fileText(owner: string, repo: string, path: string, ref: string): Promise<string> {
        const apiPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`;
        const key = `raw:${apiPath}`;
        const hit = this.cached<string>(key);
        if (hit !== undefined) return hit;
        const res = await this.request(apiPath, 'application/vnd.github.raw+json');
        const text = await res.text();
        this.store(key, text);
        return text;
    }
}
