import type { LlmResume, ParsedResume } from './schema';
import { SCHEMA_VERSION } from './schema';
import { canonicalSkill } from '../skills/canonical.ts';

// Skill names resolve through the shared taxonomy (src/skills). Java and JavaScript stay distinct skills.
export const canonicalize = (name: string): string | null => canonicalSkill(name);

// Returns a clean https URL, or null if it isn't one. Original text is not changed elsewhere.
export const safeUrl = (raw: string): string | null => {
    try {
        const u = new URL(raw.trim().match(/^https?:\/\//i) ? raw.trim() : `https://${raw.trim()}`);
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
        u.protocol = 'https:';
        return u.toString();
    } catch {
        return null;
    }
};

const cleanUrls = (urls: string[]) => [...new Set(urls.map(safeUrl).filter((u): u is string => !!u))];

export function normalize(r: LlmResume): ParsedResume {
    return {
        schema_version: SCHEMA_VERSION,
        skills: r.skills.map((s) => ({ ...s, canonical_name: canonicalize(s.name) ?? s.canonical_name })),
        projects: r.projects.map((p) => ({ ...p, repository_urls: cleanUrls(p.repository_urls) })),
        experience: r.experience,
        links: {
            github_profiles: cleanUrls(r.links.github_profiles),
            github_repositories: cleanUrls(r.links.github_repositories),
            portfolios: cleanUrls(r.links.portfolios),
        },
    };
}
