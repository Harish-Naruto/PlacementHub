// Recognises the same opening arriving from more than one source. Pure: no database.
//
//   exact  same normalised company + title + city  -> same opening
//   fuzzy  same normalised company, and 0.6 * title similarity + 0.4 * skill overlap >= FUZZY_MERGE_THRESHOLD
//          (title: Jaccard of the title words; skills: share of the shorter skill list found in the other)
//
// Anything below the threshold stays a separate opening (a wrong merge hides a real job, a missed merge
// only shows a duplicate), so the threshold is deliberately high.

import { createHash } from 'node:crypto';
import { canonicalSkill } from '../skills/canonical.ts';

export const FUZZY_MERGE_THRESHOLD = 80;
export const TITLE_WEIGHT = 0.6;
export const SKILL_WEIGHT = 0.4;

const COMPANY_NOISE = new Set(['inc', 'incorporated', 'pvt', 'private', 'ltd', 'limited', 'llp', 'llc', 'corp', 'corporation', 'co', 'company', 'technologies', 'technology', 'solutions', 'software', 'systems', 'services', 'india', 'the']);

export function normalizeCompany(name: string | null | undefined): string {
    if (!name) return '';
    return name
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9 ]+/g, ' ')
        .split(/\s+/)
        .filter((w) => w && !COMPANY_NOISE.has(w))
        .join(' ');
}

const TITLE_STOP = new Set(['a', 'an', 'the', 'for', 'and', 'at', 'in', 'of', 'to', 'with', 'hiring', 'urgent', 'opening', 'openings', 'role', 'position', 'job', 'fresher', 'freshers', 'entry', 'level', 'wanted', 'required', 'immediate', 'joiner', 'remote', 'hybrid', 'onsite']);
const TITLE_SYNONYM: Record<string, string> = { developer: 'engineer', dev: 'engineer', programmer: 'engineer', sde: 'software engineer', swe: 'software engineer', 'sde-1': 'software engineer', trainee: 'intern', internship: 'intern' };

export function titleTokens(title: string | null | undefined): string[] {
    if (!title) return [];
    const stripped = title
        .replace(/[([{][^)\]}]*[)\]}]/g, ' ') // (0-2 years), [Remote]
        .replace(/\b20[2-3]\d\b/g, ' ')
        .replace(/\b\d+\s*(?:-|to)\s*\d+\s*(?:years?|yrs?)\b/gi, ' ');
    const tokens: string[] = [];
    for (const raw of stripped.split(/[\s,|/\\–—:]+|\s-\s/)) {
        const word = raw.replace(/^[^A-Za-z0-9+#.]+|[^A-Za-z0-9+#]+$/g, '');
        if (!word) continue;
        const skill = canonicalSkill(word);
        let token = skill ? skill.toLowerCase() : word.toLowerCase();
        if (TITLE_STOP.has(token)) continue;
        token = TITLE_SYNONYM[token] ?? token;
        for (const t of token.split(' ')) if (!TITLE_STOP.has(t)) tokens.push(t);
    }
    return [...new Set(tokens)].sort();
}

const CITY_ALIASES: Record<string, string> = { bengaluru: 'bangalore', gurugram: 'gurgaon', bombay: 'mumbai', 'navi mumbai': 'mumbai', 'new delhi': 'delhi', poona: 'pune', calcutta: 'kolkata', madras: 'chennai' };

export function normalizeCity(location: string | null | undefined): string {
    if (!location) return '';
    const first = location
        .toLowerCase()
        .replace(/\(.*?\)/g, ' ')
        .split(/[,/|;]| - /)[0]!
        .replace(/[^a-z ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (/^(remote|work from home|wfh|anywhere|india)$/.test(first)) return first === 'india' ? '' : 'remote';
    return CITY_ALIASES[first] ?? first;
}

export interface JobSignature {
    company: string | null;
    title: string;
    location: string | null;
    skills: string[];
}

export function dedupeKey(job: Pick<JobSignature, 'company' | 'title' | 'location'>): string {
    const parts = [normalizeCompany(job.company), titleTokens(job.title).join(' '), normalizeCity(job.location)];
    return createHash('sha1').update(parts.join('|')).digest('hex');
}

function jaccard(a: string[], b: string[]): number {
    if (a.length === 0 && b.length === 0) return 0;
    const setB = new Set(b);
    const inter = a.filter((x) => setB.has(x)).length;
    return inter / (new Set([...a, ...b]).size || 1);
}

/** Share of the smaller list found in the other: a shorter posting naming a subset of the skills is the same job. */
function overlap(a: string[], b: string[]): number {
    const small = a.length <= b.length ? a : b;
    const large = new Set(a.length <= b.length ? b : a);
    return small.length ? small.filter((x) => large.has(x)).length / small.length : 0;
}

/** 0-100 similarity of two openings (company is checked separately). */
export function similarity(a: JobSignature, b: JobSignature): number {
    const title = jaccard(titleTokens(a.title), titleTokens(b.title));
    const skillsA = [...new Set(a.skills.map((s) => s.toLowerCase()))];
    const skillsB = [...new Set(b.skills.map((s) => s.toLowerCase()))];
    // Without skills on both sides only the title can speak.
    if (skillsA.length === 0 || skillsB.length === 0) return Math.round(title * 100);
    return Math.round(100 * (TITLE_WEIGHT * title + SKILL_WEIGHT * overlap(skillsA, skillsB)));
}

export interface ExistingJob extends JobSignature {
    id: string;
    dedupeKey: string | null;
}

export type DuplicateDecision =
    | { kind: 'exact'; jobId: string; similarity: 100 }
    | { kind: 'fuzzy'; jobId: string; similarity: number }
    | { kind: 'none'; similarity: number };

/** Finds the existing opening the candidate duplicates, if any. */
export function findDuplicate(candidate: JobSignature, existing: ExistingJob[]): DuplicateDecision {
    const key = dedupeKey(candidate);
    const exact = existing.find((e) => (e.dedupeKey ?? dedupeKey(e)) === key);
    if (exact) return { kind: 'exact', jobId: exact.id, similarity: 100 };

    const company = normalizeCompany(candidate.company);
    let best: { id: string; score: number } | null = null;
    if (company) {
        for (const e of existing) {
            if (normalizeCompany(e.company) !== company) continue;
            // The same role in two different cities is two openings. A remote listing is compatible with any city.
            const cityA = normalizeCity(candidate.location);
            const cityB = normalizeCity(e.location);
            if (cityA && cityB && cityA !== 'remote' && cityB !== 'remote' && cityA !== cityB) continue;
            const score = similarity(candidate, e);
            if (!best || score > best.score) best = { id: e.id, score };
        }
    }
    if (best && best.score >= FUZZY_MERGE_THRESHOLD) return { kind: 'fuzzy', jobId: best.id, similarity: best.score };
    return { kind: 'none', similarity: best?.score ?? 0 };
}

export interface SkillRequirement {
    skill: string;
    type: 'REQUIRED' | 'PREFERRED';
}

/** Union of two skill lists; REQUIRED beats PREFERRED. Order of the first list is kept. */
export function mergeRequirements(a: SkillRequirement[], b: SkillRequirement[]): SkillRequirement[] {
    const merged = new Map<string, SkillRequirement>();
    for (const r of [...a, ...b]) {
        const key = r.skill.toLowerCase();
        const prev = merged.get(key);
        if (!prev) merged.set(key, { ...r });
        else if (r.type === 'REQUIRED') prev.type = 'REQUIRED';
    }
    return [...merged.values()];
}
