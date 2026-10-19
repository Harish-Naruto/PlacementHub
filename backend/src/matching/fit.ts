// Student x opening fit. Pure: no database, network or LLM, so the score, the explanation and the gaps
// are reproducible and can never contain a fact that is not in the inputs.
//
//   credit  per skill, 0..1, from the stored evidence scores:
//             combined score          -> score / 100
//             GitHub evidence only    -> capped at OBSERVED_ONLY_CAP (seen in code, never assessed)
//             self-declared / missing -> 0
//   weight  requirement weight x (REQUIRED 1.0 | PREFERRED 0.5)
//   fit     round(100 * sum(weight * credit) / sum(weight))
//
// Eligibility (CGPA, branch, graduation year, deadline) is reported next to the score, never inside it.

import { canonicalOrSelf } from '../skills/canonical.ts';
import { branchKey } from './branches.ts';

export const REQUIRED_WEIGHT = 1.0;
export const PREFERRED_WEIGHT = 0.25;
/** A skill seen only in GitHub code (no assessment) earns at most this share of full credit. */
export const OBSERVED_ONLY_CAP = 0.5;
/** A combined score at or above this counts as demonstrated. */
export const DEMONSTRATED_SCORE = 60;

export const BANDS = [
    { min: 70, label: 'Strong' },
    { min: 50, label: 'Good' },
    { min: 30, label: 'Partial' },
    { min: 0, label: 'Low' },
] as const;

export type FitBand = 'Strong' | 'Good' | 'Partial' | 'Low' | 'Unknown';

export const bandFor = (score: number | null): FitBand => (score === null ? 'Unknown' : BANDS.find((b) => score >= b.min)!.label);

export interface StudentSkillInput {
    skill: string;
    combinedScore: number | null;
    assessmentScore: number | null;
    githubScore: number | null;
    status: 'SELF_DECLARED' | 'REPOSITORY_OBSERVED' | 'EVALUATED' | 'NEEDS_REVIEW';
    evidenceUrls?: string[];
}

export interface StudentInput {
    cgpa: number | null;
    branch: string | null;
    graduationYear: number | null;
    skills: StudentSkillInput[];
}

export interface JobRequirementInput {
    skill: string;
    type: 'REQUIRED' | 'PREFERRED';
    weight?: number;
}

export interface JobInput {
    requirements: JobRequirementInput[];
    minCgpa: number | null;
    eligibleBranches: string[];
    graduationYears: number[];
    deadline: Date | null;
}

export type GapKind = 'missing' | 'claimed_only' | 'weak' | 'observed_only';

export interface MatchedSkill {
    skill: string;
    requirement: 'REQUIRED' | 'PREFERRED';
    credit: number;
    combinedScore: number | null;
    detail: string;
    evidenceUrls: string[];
}

export interface Gap {
    skill: string;
    kind: GapKind;
    requirement: 'REQUIRED' | 'PREFERRED';
    detail: string;
    /** What the student can do about it. */
    action: string;
}

export interface Eligibility {
    eligible: boolean;
    /** Reasons the student is not eligible. */
    flags: string[];
    /** Checks that could not be made because data is missing. */
    unknown: string[];
}

export interface FitResult {
    fitScore: number | null;
    band: FitBand;
    matched: MatchedSkill[];
    gaps: Gap[];
    eligibility: Eligibility;
    explanation: string;
    requiredTotal: number;
    requiredDemonstrated: number;
}

interface Credit {
    credit: number;
    kind: 'demonstrated' | GapKind;
    detail: string;
    combinedScore: number | null;
    evidenceUrls: string[];
}

function creditFor(skill: StudentSkillInput | undefined, requirement: string): Credit {
    if (!skill) return { credit: 0, kind: 'missing', detail: 'not on the profile', combinedScore: null, evidenceUrls: [] };
    const urls = skill.evidenceUrls ?? [];
    if (skill.combinedScore !== null) {
        const score = skill.combinedScore;
        const parts = [skill.assessmentScore !== null ? `assessment ${skill.assessmentScore}%` : null, skill.githubScore !== null ? 'GitHub evidence' : null].filter(Boolean);
        const basis = parts.length ? ` (${parts.join(', ')})` : '';
        if (score >= DEMONSTRATED_SCORE) return { credit: score / 100, kind: 'demonstrated', detail: `score ${score}${basis}`, combinedScore: score, evidenceUrls: urls };
        return { credit: score / 100, kind: 'weak', detail: `scored ${score}${basis}, below the ${DEMONSTRATED_SCORE} needed to count as demonstrated`, combinedScore: score, evidenceUrls: urls };
    }
    if (skill.githubScore !== null) {
        return {
            credit: Math.min(OBSERVED_ONLY_CAP, (OBSERVED_ONLY_CAP * skill.githubScore) / 100),
            kind: 'observed_only',
            detail: 'seen in the student\'s GitHub code but not assessed',
            combinedScore: null,
            evidenceUrls: urls,
        };
    }
    void requirement;
    return { credit: 0, kind: 'claimed_only', detail: 'claimed on the resume, no evidence yet', combinedScore: null, evidenceUrls: [] };
}

const ACTION: Record<GapKind, (skill: string) => string> = {
    missing: (s) => `Learn ${s} and prove it with a project or an assessment.`,
    claimed_only: (s) => `Take the ${s} assessment or link a GitHub project that uses it.`,
    weak: (s) => `Practise ${s} and retake the assessment.`,
    observed_only: (s) => `Take the ${s} assessment to turn repository evidence into a verified skill.`,
};

export function checkEligibility(student: Pick<StudentInput, 'cgpa' | 'branch' | 'graduationYear'>, job: Pick<JobInput, 'minCgpa' | 'eligibleBranches' | 'graduationYears' | 'deadline'>, now = new Date()): Eligibility {
    const flags: string[] = [];
    const unknown: string[] = [];

    if (job.minCgpa !== null) {
        if (student.cgpa === null) unknown.push(`CGPA not on the profile (minimum ${job.minCgpa})`);
        else if (student.cgpa < job.minCgpa) flags.push(`CGPA ${student.cgpa} is below the ${job.minCgpa} minimum`);
    }
    if (job.eligibleBranches.length) {
        const allowed = new Set(job.eligibleBranches.map((b) => branchKey(b) ?? b.toLowerCase()));
        const mine = branchKey(student.branch);
        if (!student.branch) unknown.push(`Branch not on the profile (open to ${job.eligibleBranches.join(', ')})`);
        else if (!allowed.has(mine ?? student.branch.toLowerCase())) flags.push(`Branch ${student.branch} is not in the eligible list (${job.eligibleBranches.join(', ')})`);
    }
    if (job.graduationYears.length) {
        if (student.graduationYear === null) unknown.push(`Graduation year not on the profile (batches ${job.graduationYears.join(', ')})`);
        else if (!job.graduationYears.includes(student.graduationYear)) flags.push(`Graduation year ${student.graduationYear} is not in the eligible batches (${job.graduationYears.join(', ')})`);
    }
    if (job.deadline && job.deadline.getTime() < now.getTime()) flags.push('The application deadline has passed');

    return { eligible: flags.length === 0, flags, unknown };
}

export function computeFit(student: StudentInput, job: JobInput, now = new Date()): FitResult {
    const byKey = new Map<string, StudentSkillInput>();
    for (const s of student.skills) {
        const key = canonicalOrSelf(s.skill).toLowerCase();
        const prev = byKey.get(key);
        // If a skill appears twice keep the one with more evidence.
        if (!prev || (s.combinedScore ?? -1) > (prev.combinedScore ?? -1)) byKey.set(key, s);
    }

    const matched: MatchedSkill[] = [];
    const gaps: Gap[] = [];
    let weighted = 0;
    let totalWeight = 0;
    let requiredTotal = 0;
    let requiredDemonstrated = 0;

    // De-duplicate requirements by canonical skill; REQUIRED beats PREFERRED.
    const reqs = new Map<string, JobRequirementInput>();
    for (const r of job.requirements) {
        const key = canonicalOrSelf(r.skill).toLowerCase();
        const prev = reqs.get(key);
        if (!prev || (r.type === 'REQUIRED' && prev.type !== 'REQUIRED')) reqs.set(key, { ...r, skill: canonicalOrSelf(r.skill) });
    }

    for (const [key, r] of reqs) {
        const c = creditFor(byKey.get(key), r.type);
        const weight = (r.weight ?? 1) * (r.type === 'REQUIRED' ? REQUIRED_WEIGHT : PREFERRED_WEIGHT);
        weighted += weight * c.credit;
        totalWeight += weight;
        if (r.type === 'REQUIRED') {
            requiredTotal++;
            if (c.kind === 'demonstrated') requiredDemonstrated++;
        }
        if (c.kind === 'demonstrated') {
            matched.push({ skill: r.skill, requirement: r.type, credit: c.credit, combinedScore: c.combinedScore, detail: c.detail, evidenceUrls: c.evidenceUrls });
        } else {
            gaps.push({ skill: r.skill, kind: c.kind, requirement: r.type, detail: c.detail, action: ACTION[c.kind](r.skill) });
        }
    }

    const fitScore = totalWeight > 0 ? Math.round((100 * weighted) / totalWeight) : null;
    const eligibility = checkEligibility(student, job, now);
    const band = bandFor(fitScore);
    matched.sort((a, b) => Number(b.requirement === 'REQUIRED') - Number(a.requirement === 'REQUIRED') || b.credit - a.credit);
    gaps.sort((a, b) => Number(b.requirement === 'REQUIRED') - Number(a.requirement === 'REQUIRED'));

    return {
        fitScore,
        band,
        matched,
        gaps,
        eligibility,
        explanation: explain({ fitScore, band, matched, gaps, eligibility, requiredTotal, requiredDemonstrated }),
        requiredTotal,
        requiredDemonstrated,
    };
}

// ---------------------------------------------------------------------------
// Plain-language explanation (templates over the structured result)
// ---------------------------------------------------------------------------

const GAP_PHRASE: Record<GapKind, string> = {
    missing: 'is not on the profile',
    claimed_only: 'is claimed but has no evidence yet',
    weak: 'was assessed below the pass mark',
    observed_only: 'appears in GitHub code but was never assessed',
};

function explain(r: Omit<FitResult, 'explanation'>): string {
    if (r.fitScore === null) return 'This opening lists no skills, so a skill-based fit cannot be computed.';
    const parts: string[] = [`${r.band} fit (${r.fitScore}/100).`];

    if (r.matched.length) {
        const top = r.matched.slice(0, 5).map((m) => `${m.skill} (${m.combinedScore})`);
        parts.push(`Demonstrated: ${top.join(', ')}${r.matched.length > 5 ? ` and ${r.matched.length - 5} more` : ''}.`);
    } else {
        parts.push('No required or preferred skill is demonstrated by evidence yet.');
    }
    if (r.requiredTotal > 0) parts.push(`${r.requiredDemonstrated} of ${r.requiredTotal} required skills are demonstrated.`);

    const required = r.gaps.filter((g) => g.requirement === 'REQUIRED');
    const preferred = r.gaps.filter((g) => g.requirement === 'PREFERRED');
    if (required.length) parts.push(`Required gaps: ${required.map((g) => `${g.skill} ${GAP_PHRASE[g.kind]}`).join('; ')}.`);
    if (preferred.length) parts.push(`Preferred gaps: ${preferred.map((g) => g.skill).join(', ')}.`);

    if (!r.eligibility.eligible) parts.push(`Not eligible: ${r.eligibility.flags.join('; ')}.`);
    else if (r.eligibility.unknown.length) parts.push(`Could not check: ${r.eligibility.unknown.join('; ')}.`);
    else parts.push('Eligibility checks pass.');
    return parts.join(' ');
}
