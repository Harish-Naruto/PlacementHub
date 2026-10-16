import config from '../config/index.ts';
import { lookupRule, type TechRule } from './catalog.ts';
import { GithubError, type GithubClient } from './client.ts';
import type { RepoFacts } from './detect.ts';

export interface RepoMeta {
    name: string;
    full_name: string;
    html_url: string;
    description: string | null;
    private?: boolean;
    fork: boolean;
    archived?: boolean;
    default_branch: string;
    pushed_at: string | null;
    language: string | null;
    topics?: string[];
}

export interface CollectLimits {
    maxFiles: number;
    maxFileBytes: number;
}

export interface CollectedRepo {
    meta: RepoMeta;
    facts: RepoFacts;
    status: 'examined' | 'partially_examined';
    filesExamined: number;
    notes: string[];
    /** True when a rate limit / request budget stopped collection early. */
    incomplete: boolean;
}

const MANIFEST_NAMES = new Set(['package.json', 'requirements.txt', 'pyproject.toml', 'go.mod', 'Cargo.toml', 'pom.xml', 'build.gradle', 'build.gradle.kts']);
const MAX_MANIFESTS = 4;
const SKIP_PATH = /(^|\/)(node_modules|dist|build|out|coverage|vendor|generated|\.next|\.git|__pycache__)\//;
const SKIP_FILE = /(\.min\.|\.d\.ts$|\.map$|\.lock$|-lock\.json$|(^|\/)\.env)/;
const ext = (p: string) => (p.includes('.') ? p.slice(p.lastIndexOf('.') + 1).toLowerCase() : '');
const depth = (p: string) => p.split('/').length;

export const defaultLimits = (): CollectLimits => ({
    maxFiles: config.githubMaxFilesPerRepo,
    maxFileBytes: config.githubMaxFileBytes,
});

function manifestPackages(path: string, text: string): Set<string> {
    const out = new Set<string>();
    if (path.endsWith('package.json')) {
        try {
            const pkg = JSON.parse(text) as Record<string, unknown>;
            for (const key of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
                const section = pkg[key];
                if (section && typeof section === 'object') for (const n of Object.keys(section)) out.add(n.toLowerCase());
            }
        } catch {
            /* malformed manifest: treat as no evidence */
        }
        return out;
    }
    for (const t of text.toLowerCase().match(/[a-z0-9_.@/-]+/g) ?? []) out.add(t);
    return out;
}

// Claim-driven file choice: for each claimed technology rank candidate source files by path hints,
// then take them round-robin so one technology cannot use the whole budget.
export function selectSourceFiles(paths: { path: string; size: number }[], techs: TechRule[], limits: CollectLimits): string[] {
    const scannable = techs.filter((t) => t.source?.length || t.packages?.length);
    const candidates = paths.filter(
        (p) => p.size > 0 && p.size <= limits.maxFileBytes && !SKIP_PATH.test(p.path) && !SKIP_FILE.test(p.path),
    );

    const ranked = scannable.map((t) => {
        const exts = t.sourceExts ?? ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'vue'];
        return candidates
            .filter((p) => exts.includes(ext(p.path)))
            .map((p) => {
                const hint = t.pathHints?.some((re) => re.test(p.path)) ? 10 : 0;
                const isTest = /(^|\/)(__tests__|tests?)\/|\.(test|spec)\./.test(p.path) ? 3 : 0;
                return { path: p.path, score: hint - isTest - depth(p.path) * 0.5 };
            })
            .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
            .map((x) => x.path);
    });

    const chosen: string[] = [];
    const seen = new Set<string>();
    for (let round = 0; chosen.length < limits.maxFiles; round++) {
        let progressed = false;
        for (const list of ranked) {
            const next = list.slice(round).find((p) => !seen.has(p));
            if (next && chosen.length < limits.maxFiles) {
                seen.add(next);
                chosen.push(next);
                progressed = true;
            }
        }
        if (!progressed) break;
    }
    return chosen;
}

// Fetches metadata, tree, manifests and a bounded set of source files for one repository.
// Throws GithubError only when the repository itself cannot be read; later problems become notes.
export async function collectRepo(
    client: GithubClient,
    owner: string,
    name: string,
    wanted: string[], // canonical technology names to look for
    limits: CollectLimits = defaultLimits(),
    knownMeta?: RepoMeta,
): Promise<CollectedRepo> {
    const meta = knownMeta ?? (await client.json<RepoMeta>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`));
    // Never read private repositories; that needs explicit candidate authorization (not implemented).
    if (meta.private) throw new GithubError('forbidden', 403, 'Repository is private');

    const [o, r] = [encodeURIComponent(owner), encodeURIComponent(name)];
    const notes: string[] = [];
    let incomplete = false;
    const facts: RepoFacts = { repo: meta.full_name, sha: null, languages: {}, paths: [], manifests: [], sources: [] };
    if (meta.fork) notes.push('Repository is a fork; ownership does not show the candidate wrote its code.');
    if (meta.archived) notes.push('Repository is archived.');

    const note = (msg: string) => {
        if (!notes.includes(msg)) notes.push(msg);
    };
    const soft = (e: unknown, what: string) => {
        if (e instanceof GithubError && (e.kind === 'rate_limited' || e.kind === 'budget_exhausted')) {
            incomplete = true;
            note(`${what} skipped: ${e.kind === 'rate_limited' ? 'GitHub rate limit reached' : 'request budget exhausted'}.`);
        } else {
            note(`${what} could not be retrieved.`);
        }
    };

    try {
        const commits = await client.json<{ sha: string }[]>(`/repos/${o}/${r}/commits?per_page=1&sha=${encodeURIComponent(meta.default_branch)}`);
        facts.sha = commits[0]?.sha ?? null;
    } catch (e) {
        soft(e, 'Latest commit lookup');
    }
    if (!facts.sha) {
        notes.push('No commit available (empty repository or lookup failed); nothing could be inspected.');
        return { meta, facts, status: 'partially_examined', filesExamined: 0, notes, incomplete };
    }

    try {
        facts.languages = await client.json<Record<string, number>>(`/repos/${o}/${r}/languages`);
    } catch (e) {
        soft(e, 'Language statistics');
    }

    try {
        const tree = await client.json<{ tree: { path: string; type: string; size?: number }[]; truncated?: boolean }>(
            `/repos/${o}/${r}/git/trees/${facts.sha}?recursive=1`,
        );
        facts.paths = tree.tree.filter((t) => t.type === 'blob').map((t) => ({ path: t.path, size: t.size ?? 0 }));
        if (tree.truncated) notes.push('Repository tree was truncated by GitHub; some files were not visible.');
    } catch (e) {
        soft(e, 'Repository tree');
        return { meta, facts, status: 'partially_examined', filesExamined: 0, notes, incomplete };
    }

    const rules = wanted.map(lookupRule).filter((x): x is TechRule => !!x);
    const manifestPaths = facts.paths
        .filter((p) => MANIFEST_NAMES.has(p.path.split('/').pop()!) && !SKIP_PATH.test(p.path) && p.size <= limits.maxFileBytes)
        .sort((a, b) => depth(a.path) - depth(b.path))
        .slice(0, MAX_MANIFESTS)
        .map((p) => p.path);
    const sourcePaths = selectSourceFiles(facts.paths, rules, limits);
    const isManifest = new Set(manifestPaths);

    let filesExamined = 0;
    const fetchOne = async (path: string) => {
        if (incomplete) return;
        try {
            const text = await client.fileText(owner, name, path, facts.sha!);
            filesExamined++;
            if (isManifest.has(path)) facts.manifests.push({ path, packages: manifestPackages(path, text) });
            else facts.sources.push({ path, text: text.slice(0, limits.maxFileBytes) });
        } catch (e) {
            if (e instanceof GithubError && (e.kind === 'rate_limited' || e.kind === 'budget_exhausted')) soft(e, 'File retrieval');
            // other per-file failures are ignored: absent evidence is not contradiction
        }
    };
    const all = [...manifestPaths, ...sourcePaths];
    for (let i = 0; i < all.length; i += 4) await Promise.all(all.slice(i, i + 4).map(fetchOne));

    if (sourcePaths.length >= limits.maxFiles) notes.push(`Only ${limits.maxFiles} source files were sampled; other files were not inspected.`);
    return { meta, facts, status: incomplete ? 'partially_examined' : 'examined', filesExamined, notes, incomplete };
}
