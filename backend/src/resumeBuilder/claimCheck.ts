// Checks the claims in an uploaded (parsed) resume against the student's stored evidence.
// Pure: the service loads the parsed resume and the student's skills and calls this.
//
// Verdicts are about evidence, never about honesty: "unsupported" and "unverified" mean "not backed by
// evidence yet", not "proven false".

import { canonicalOrSelf, findSkillMentions } from '../skills/canonical.ts';
import type { ParsedResume } from '../resume/schema.ts';
import { hasUnverifiableMetric, type BuilderSkill } from './build.ts';

export type ClaimVerdict = 'supported' | 'partially_supported' | 'self_reported' | 'needs_review' | 'unsupported' | 'unverified';

export interface ClaimEntry {
    kind: 'skill' | 'project_technology' | 'project_feature' | 'experience_dates' | 'experience_responsibility';
    claim: string;
    where: string;
    verdict: ClaimVerdict;
    flagged: boolean;
    reason: string;
    /** Evidence links or ids behind a supported verdict. */
    proof: string[];
}

export interface ClaimCheckResult {
    entries: ClaimEntry[];
    summary: Record<ClaimVerdict, number> & { total: number; flagged: number };
}

const FLAGGED: ClaimVerdict[] = ['needs_review', 'unsupported', 'unverified'];

export function skillVerdict(skill: BuilderSkill | undefined): { verdict: ClaimVerdict; reason: string; proof: string[] } {
    if (!skill) return { verdict: 'unverified', reason: 'no assessment or GitHub evidence for this skill yet', proof: [] };
    const proof = [...(skill.assessmentScore !== null ? [`assessment:${skill.assessmentScore}%`] : []), ...skill.evidenceUrls.slice(0, 3)];
    switch (skill.status) {
        case 'EVALUATED':
            return { verdict: 'supported', reason: skill.assessmentScore !== null ? `assessment ${skill.assessmentScore}%${skill.evidenceUrls.length ? ' plus GitHub evidence' : ''}` : 'evaluated', proof };
        case 'REPOSITORY_OBSERVED':
            return { verdict: 'partially_supported', reason: 'only one source supports it (GitHub code, or a moderate assessment)', proof };
        case 'NEEDS_REVIEW':
            return skill.assessmentScore !== null && skill.githubScore === null
                ? { verdict: 'unsupported', reason: `assessed at ${skill.assessmentScore}% with no GitHub evidence`, proof }
                : { verdict: 'needs_review', reason: 'the assessment and the repository evidence disagree', proof };
        default:
            return { verdict: 'unverified', reason: 'claimed on the resume, no evidence yet', proof: [] };
    }
}

// ---- dates -------------------------------------------------------------------------------------

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Parses "2023", "Jun 2023", "06/2023", "June 2023". Returns months since year 0, or null. */
export function parseMonth(text: string | null): number | null {
    if (!text) return null;
    const t = text.trim().toLowerCase();
    if (/^(present|current|now|ongoing)$/.test(t)) return null;
    let m = t.match(/^([a-z]{3,9})\.?\s+(\d{4})$/);
    if (m) {
        const mi = MONTHS.indexOf(m[1]!.slice(0, 3));
        if (mi >= 0) return Number(m[2]) * 12 + mi;
    }
    m = t.match(/^(\d{1,2})[/\-.](\d{4})$/);
    if (m) return Number(m[2]) * 12 + (Number(m[1]) - 1);
    m = t.match(/^(\d{4})$/);
    if (m) return Number(m[1]) * 12;
    return null;
}

function checkDates(start: string | null, end: string | null, now: Date): string | null {
    const s = parseMonth(start);
    const e = parseMonth(end);
    const nowMonth = now.getFullYear() * 12 + now.getMonth();
    if (s !== null && e !== null && e < s) return 'the end date is before the start date';
    if (s !== null && s > nowMonth + 3) return 'the start date is in the future';
    return null;
}

// ---- main --------------------------------------------------------------------------------------

export function checkResumeClaims(resume: ParsedResume, studentSkills: BuilderSkill[], now = new Date()): ClaimCheckResult {
    const bySkill = new Map<string, BuilderSkill>();
    for (const s of studentSkills) {
        const k = canonicalOrSelf(s.skill).toLowerCase();
        const prev = bySkill.get(k);
        if (!prev || (s.combinedScore ?? -1) > (prev.combinedScore ?? -1)) bySkill.set(k, s);
    }
    const lookup = (name: string) => bySkill.get(canonicalOrSelf(name).toLowerCase());
    const entries: ClaimEntry[] = [];
    const push = (e: Omit<ClaimEntry, 'flagged'>) => entries.push({ ...e, flagged: FLAGGED.includes(e.verdict) });

    // Listed skills, once per canonical skill.
    const seen = new Set<string>();
    for (const s of resume.skills) {
        const name = canonicalOrSelf(s.canonical_name ?? s.name);
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const v = skillVerdict(lookup(name));
        push({ kind: 'skill', claim: name, where: s.claim_type === 'listed_skill' ? 'Skills section' : s.claim_type === 'project_technology' ? 'Project technology' : 'Experience technology', ...v });
    }

    // Project technologies and features.
    for (const p of resume.projects) {
        const techSeen = new Set<string>();
        for (const t of p.technologies) {
            const name = canonicalOrSelf(t);
            if (techSeen.has(name.toLowerCase())) continue;
            techSeen.add(name.toLowerCase());
            const v = skillVerdict(lookup(name));
            push({ kind: 'project_technology', claim: `${name} in "${p.name}"`, where: `Project: ${p.name}`, ...v });
        }
        for (const f of p.features) {
            const unverified = findSkillMentions(f.claim).map((m) => m.skill).filter((s) => ['unverified', 'unsupported', 'needs_review'].includes(skillVerdict(lookup(s)).verdict));
            if (unverified.length) {
                push({ kind: 'project_feature', claim: f.claim, where: `Project: ${p.name}`, verdict: 'unsupported', reason: `mentions ${unverified.join(', ')}, which has no supporting evidence`, proof: [] });
            } else if (hasUnverifiableMetric(f.claim)) {
                push({ kind: 'project_feature', claim: f.claim, where: `Project: ${p.name}`, verdict: 'unverified', reason: 'states a number or result that cannot be verified', proof: [] });
            } else {
                push({ kind: 'project_feature', claim: f.claim, where: `Project: ${p.name}`, verdict: 'self_reported', reason: 'a description only the student can attest; nothing in the evidence contradicts it', proof: [] });
            }
        }
    }

    // Experience: dates and responsibilities.
    for (const x of resume.experience) {
        const label = x.organization ?? x.title ?? 'Experience';
        const dateProblem = checkDates(x.start_date, x.end_date, now);
        if (dateProblem) push({ kind: 'experience_dates', claim: `${label}: ${x.start_date ?? '?'} – ${x.end_date ?? (x.is_current ? 'Present' : '?')}`, where: `Experience: ${label}`, verdict: 'needs_review', reason: dateProblem, proof: [] });
        for (const r of x.responsibilities) {
            const unverified = findSkillMentions(r).map((m) => m.skill).filter((s) => ['unverified', 'unsupported', 'needs_review'].includes(skillVerdict(lookup(s)).verdict));
            if (unverified.length) push({ kind: 'experience_responsibility', claim: r, where: `Experience: ${label}`, verdict: 'unsupported', reason: `mentions ${unverified.join(', ')}, which has no supporting evidence`, proof: [] });
            else if (hasUnverifiableMetric(r)) push({ kind: 'experience_responsibility', claim: r, where: `Experience: ${label}`, verdict: 'unverified', reason: 'states a number or result that cannot be verified', proof: [] });
            else push({ kind: 'experience_responsibility', claim: r, where: `Experience: ${label}`, verdict: 'self_reported', reason: 'a description only the student can attest', proof: [] });
        }
    }

    const summary = { supported: 0, partially_supported: 0, self_reported: 0, needs_review: 0, unsupported: 0, unverified: 0, total: entries.length, flagged: 0 } as ClaimCheckResult['summary'];
    for (const e of entries) {
        summary[e.verdict]++;
        if (e.flagged) summary.flagged++;
    }
    return { entries, summary };
}
