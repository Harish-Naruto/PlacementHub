import { lookupRule, type TechRule } from './catalog.ts';
import type { Evidence, EvidenceStrength, EvidenceType } from './types.ts';

// Facts gathered from one repository at one commit. Detection below is pure and deterministic.
export interface RepoFacts {
    repo: string; // owner/name
    sha: string | null;
    languages: Record<string, number>;
    paths: { path: string; size: number }[];
    manifests: { path: string; packages: Set<string> }[];
    sources: { path: string; text: string }[];
}

export const blobUrl = (repo: string, sha: string | null, path: string) =>
    sha ? `https://github.com/${repo}/blob/${sha}/${path.split('/').map(encodeURIComponent).join('/')}` : null;

const ext = (p: string) => (p.includes('.') ? p.slice(p.lastIndexOf('.') + 1).toLowerCase() : '');
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const importRe = (pkg: string) =>
    new RegExp(`(?:from\\s+|require\\(\\s*|import\\s+|import\\(\\s*)['"]${escapeRe(pkg)}(?:/[^'"]*)?['"]`);

const SOURCE_DEFAULT_EXTS = ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'vue'];

const ev = (
    f: RepoFacts,
    evidence_type: EvidenceType,
    path: string | null,
    observation: string,
    strength: EvidenceStrength,
): Evidence => ({
    evidence_type,
    repository: f.repo,
    path,
    url: path ? blobUrl(f.repo, f.sha, path) : `https://github.com/${f.repo}`,
    commit_sha: f.sha,
    observation,
    strength,
});

// Evidence for one technology in one repository. Observations are generated here, never copied from repo text.
export function detectTechnology(name: string, f: RepoFacts, rule: TechRule | undefined = lookupRule(name)): Evidence[] {
    if (!rule) return [];
    const out: Evidence[] = [];

    // Language statistics: discovery signal only.
    const total = Object.values(f.languages).reduce((a, b) => a + b, 0);
    for (const lang of rule.languages ?? []) {
        const bytes = f.languages[lang];
        if (bytes && total) {
            const pct = Math.round((bytes / total) * 100);
            out.push(ev(f, 'language_statistics', null, `GitHub lists ${lang} among this repository's languages (~${pct}% of bytes)`, 'weak'));
            break;
        }
    }

    // File extensions present in the tree.
    if (rule.extensions?.length) {
        const matches = f.paths.filter((p) => rule.extensions!.includes(ext(p.path)));
        if (matches.length) {
            const sample = matches.sort((a, b) => a.path.split('/').length - b.path.split('/').length)[0]!;
            out.push(
                ev(f, 'file_presence', sample.path, `${matches.length} .${ext(sample.path)} file(s) present in the repository tree`, matches.length >= 3 ? 'moderate' : 'weak'),
            );
        }
    }

    // Dependency manifests.
    const packages = (rule.packages ?? []).map((p) => p.toLowerCase());
    if (packages.length) {
        let found = 0;
        for (const m of [...f.manifests].sort((a, b) => a.path.split('/').length - b.path.split('/').length)) {
            const hit = packages.find((p) => m.packages.has(p));
            if (hit && found < 2) {
                out.push(ev(f, 'dependency', m.path, `Dependency "${hit}" is declared in this manifest`, 'moderate'));
                found++;
            }
        }
    }

    // Configuration / schema files.
    if (rule.files?.length) {
        const matches = f.paths.filter((p) => rule.files!.some((re) => re.test(p.path)));
        for (const m of matches.sort((a, b) => a.path.length - b.path.length).slice(0, 2)) {
            out.push(ev(f, 'configuration', m.path, `Configuration or schema file associated with ${name} is present`, 'moderate'));
        }
    }

    // Usage in fetched source files.
    const patterns = [...packages.map(importRe), ...(rule.source ?? [])];
    const exts = rule.sourceExts ?? SOURCE_DEFAULT_EXTS;
    if (patterns.length) {
        let found = 0;
        for (const s of f.sources) {
            if (found >= 2) break;
            if (!exts.includes(ext(s.path))) continue;
            const pat = patterns.find((re) => re.test(s.text));
            if (pat) {
                const viaImport = packages.some((p) => importRe(p).test(s.text));
                out.push(
                    ev(f, 'source_code', s.path, viaImport ? `Source file imports a ${name}-related package` : `Source file contains a ${name} usage pattern`, 'strong'),
                );
                found++;
            }
        }
    }
    return out;
}

const IMPLEMENTATION: EvidenceType[] = ['source_code', 'configuration', 'file_presence'];

export type Support = 'none' | 'partial' | 'supported';

// A claim is "supported" only with an implementation signal plus a second, different kind of evidence.
// Dependency alone or language statistics alone never reach "supported".
export function assessEvidence(evidence: Evidence[]): Support {
    if (!evidence.length) return 'none';
    const types = new Set(evidence.map((e) => e.evidence_type));
    const hasImpl = [...types].some((t) => IMPLEMENTATION.includes(t));
    const strongImpl = evidence.some((e) => IMPLEMENTATION.includes(e.evidence_type) && e.strength !== 'weak');
    return hasImpl && strongImpl && types.size >= 2 ? 'supported' : 'partial';
}
