import { canonicalize } from '../resume/normalize.ts';
import type { ParsedResume } from '../resume/schema.ts';

export interface SkillClaim {
    key: string; // lower-cased canonical name, used for catalog lookup
    name: string; // display name
    references: string[];
}

export interface ProjectClaim {
    name: string;
    technologies: { key: string; name: string }[];
    featureCount: number;
    repositoryUrls: string[];
}

const key = (s: string) => s.trim().toLowerCase();

// Reuses the resume parser output; nothing is re-parsed. Skills are de-duplicated by canonical name.
export function extractClaims(resume: ParsedResume): { skills: SkillClaim[]; projects: ProjectClaim[] } {
    // name -> canonical, from the parser's own mapping first, then the shared alias table.
    const canonicalOf = new Map<string, string>();
    for (const s of resume.skills) canonicalOf.set(key(s.name), s.canonical_name ?? s.name);
    const resolve = (name: string) => {
        const c = canonicalOf.get(key(name)) ?? canonicalize(name) ?? name;
        return { key: key(c), name: c };
    };

    const skills = new Map<string, SkillClaim>();
    const add = (name: string, ref: string) => {
        const r = resolve(name);
        const existing = skills.get(r.key);
        if (existing) {
            if (!existing.references.includes(ref)) existing.references.push(ref);
        } else skills.set(r.key, { key: r.key, name: r.name, references: [ref] });
    };

    for (const s of resume.skills) {
        const section = s.evidence[0]?.section;
        const ref = s.claim_type === 'listed_skill' ? `Listed skill${section ? ` (${section})` : ''}` : s.claim_type === 'project_technology' ? 'Project technology' : 'Experience technology';
        add(s.canonical_name ?? s.name, ref);
    }
    for (const p of resume.projects) for (const t of p.technologies) add(t, `Project: ${p.name}`);
    for (const e of resume.experience) for (const t of e.technologies) add(t, `Experience: ${e.organization ?? e.title ?? 'unnamed'}`);

    const projects = resume.projects.map((p) => {
        const seen = new Set<string>();
        const technologies = p.technologies
            .map(resolve)
            .filter((t) => !seen.has(t.key) && seen.add(t.key));
        return { name: p.name, technologies, featureCount: p.features.length, repositoryUrls: p.repository_urls };
    });

    return { skills: [...skills.values()], projects };
}
