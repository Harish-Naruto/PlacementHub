// GitHub usernames: 1-39 chars, alphanumeric or single hyphens, no leading/trailing hyphen.
const USERNAME = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const REPO_NAME = /^[\w.-]{1,100}$/;

export const isValidUsername = (s: string) => USERNAME.test(s);

const githubPath = (raw: string): string[] | null => {
    try {
        const u = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
        if (!['github.com', 'www.github.com'].includes(u.hostname.toLowerCase())) return null;
        return u.pathname.split('/').filter(Boolean);
    } catch {
        return null;
    }
};

// Accepts a bare username, "@username", or a github.com profile URL. Returns null if it isn't one.
export function parseUsername(input: string): string | null {
    const s = input.trim().replace(/^@/, '');
    if (!s) return null;
    if (USERNAME.test(s)) return s;
    const parts = githubPath(s);
    return parts && parts.length === 1 && USERNAME.test(parts[0]!) ? parts[0]! : null;
}

// github.com/{owner}/{repo}[/...] -> { owner, repo }. Profile URLs and anything else return null.
export function parseRepoUrl(input: string): { owner: string; repo: string } | null {
    const parts = githubPath(input);
    if (!parts || parts.length < 2) return null;
    const owner = parts[0]!;
    const repo = parts[1]!.replace(/\.git$/i, '');
    if (!USERNAME.test(owner) || !REPO_NAME.test(repo) || repo === '.' || repo === '..') return null;
    return { owner, repo };
}

// Project/repo name comparison ignores case and punctuation: "Web-Escape" ~ "web_escape".
export const normalizeName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
