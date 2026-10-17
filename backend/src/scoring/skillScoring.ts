// ---------------------------------------------------------------------------
// Per-skill scoring: assessment score + GitHub evidence score -> combined score.
//
// Pure, deterministic TypeScript. No network, no database, no LLM.
//
// Conventions (change them here only):
//   - Every score is an integer from 0 to 100 (`roundScore`: clamp, then round to nearest).
//   - `null` means "not available / inconclusive". It never means zero.
//   - Combined scores are computed from the rounded component scores, so the arithmetic
//     shown to a user ("0.8 * 80 + 0.2 * 100 = 84") is reproducible.
//   - GitHub is supporting evidence only: it is a product heuristic for evidence strength,
//     not a probability of competence, and it never proves authorship.
// ---------------------------------------------------------------------------

import { assessEvidence } from '../github/detect.ts';
import type { Claim, ClaimStatus, Evidence, EvidenceType, VerificationReport } from '../github/types.ts';
import { canonicalize } from '../resume/normalize.ts';

// ---------------------------------------------------------------------------
// Tunable constants
// ---------------------------------------------------------------------------

/** Initial MVP weighting, applied only when both components are available. Not psychometrically validated. */
export const SCORE_WEIGHTS = { assessment: 0.8, github: 0.2 } as const;

/**
 * Assessment score bands for the per-skill verification verdict.
 * >= pass: the skill was demonstrated. < fail: the assessment did not support the claim.
 */
export const VERIFICATION_THRESHOLDS = { pass: 60, fail: 40 } as const;

/** GitHub claim status -> evidence score. `null` = unavailable / inconclusive, never a penalty. */
export const GITHUB_STATUS_SCORE: Record<ClaimStatus, number | null> = {
    supported: 100,
    partially_supported: 60,
    insufficient_evidence: null,
    needs_review: null,
    not_accessible: null,
    not_checked: null,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SkillEvidenceStrength = 'high' | 'medium' | 'low' | 'unknown';
export type SkillEvidenceType = 'dependency' | 'source_usage' | 'configuration' | 'contribution';
export type GithubReportState = 'completed' | 'incomplete' | 'not_run' | 'failed';
export type GithubSkillStatus = ClaimStatus | 'not_run';

export interface SkillEvidenceRef {
    type: SkillEvidenceType;
    repositoryUrl: string;
    evidenceUrl?: string;
    commitSha?: string;
}

/**
 * Verdict for one skill listed on the resume, from independent evidence:
 *   verified           assessment demonstrated it AND public GitHub evidence supports it
 *   partially_verified exactly one source supports it (or the sources are only weakly positive)
 *   needs_review       the sources disagree (low assessment score, but GitHub shows use)
 *   unsupported        it was assessed and not demonstrated, with no GitHub evidence
 *   unverified         no evidence either way (not assessed, and GitHub found or checked nothing)
 * `unsupported` and `unverified` mean "not backed by evidence yet", never "proven false".
 */
export type SkillVerificationStatus = 'verified' | 'partially_verified' | 'needs_review' | 'unsupported' | 'unverified';

export interface SkillVerification {
    status: SkillVerificationStatus;
    /** True when the claim should be flagged: everything except verified / partially_verified. */
    flagged: boolean;
    reason: string;
}

export interface CombinedSkillResult {
    skill: string;
    assessmentScore: number | null;
    githubEvidenceScore: number | null;
    combinedScore: number | null;
    verification: SkillVerification;
    githubStatus: GithubSkillStatus;
    evidenceStrength: SkillEvidenceStrength;
    evidenceSummary: string;
    evidenceUrls: string[];
    /** Raw marks behind `assessmentScore`, so the percentage can be audited. */
    assessmentPoints: { earned: number; possible: number } | null;
    /** Ids of the assessment questions behind `assessmentScore` (assessment proof). */
    assessmentQuestionIds: string[];
    /** Traceable public-repository evidence (never contains repository file contents). */
    evidence: SkillEvidenceRef[];
    /** Evidence that points the other way (e.g. a linked project repo with no sign of the technology). */
    conflicts: string[];
    /** Where in the resume the skill was claimed. */
    resumeReferences: string[];
}

/** The part of a graded question the scorer needs. */
export interface AssessedQuestion {
    id?: string;
    skill: string;
    /** Optional extra skills. When more than one distinct skill is present the marks are split equally. */
    skills?: string[];
    awardedPoints: number;
    maxPoints: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const roundScore = (n: number): number => Math.round(Math.min(100, Math.max(0, n)));

/** Canonical comparison key shared by assessment skills and GitHub claims. Aliases are not guessed beyond the shared table. */
export const skillKey = (name: string): string => (canonicalize(name) ?? name).trim().toLowerCase();

// ---------------------------------------------------------------------------
// Assessment score per skill
// ---------------------------------------------------------------------------

interface AssessmentAcc {
    skill: string;
    earned: number;
    possible: number;
    questionIds: string[];
}

export interface AssessmentSkillScore {
    skill: string;
    earned: number;
    possible: number;
    score: number;
    questionIds: string[];
}

/**
 * score = 100 * earned / possible, using total marks (never an average of percentages).
 * A question mapped to several distinct skills contributes `1/n` of its earned and possible marks to each.
 * Skills with no available marks are absent from the result (their score is `null`, not 0).
 */
export function scoreAssessmentSkills(questions: AssessedQuestion[]): Map<string, AssessmentSkillScore> {
    const acc = new Map<string, AssessmentAcc>();

    for (const q of questions) {
        if (!(q.maxPoints > 0)) continue;
        const earned = Math.min(q.maxPoints, Math.max(0, Number.isFinite(q.awardedPoints) ? q.awardedPoints : 0));

        const distinct = new Map<string, string>(); // key -> display name
        for (const name of q.skills && q.skills.length > 0 ? q.skills : [q.skill]) {
            const trimmed = name?.trim();
            if (trimmed && !distinct.has(skillKey(trimmed))) distinct.set(skillKey(trimmed), trimmed);
        }
        if (distinct.size === 0) continue;

        const share = 1 / distinct.size;
        for (const [key, display] of distinct) {
            const cur = acc.get(key) ?? { skill: display, earned: 0, possible: 0, questionIds: [] };
            cur.earned += earned * share;
            cur.possible += q.maxPoints * share;
            if (q.id && !cur.questionIds.includes(q.id)) cur.questionIds.push(q.id);
            acc.set(key, cur);
        }
    }

    const out = new Map<string, AssessmentSkillScore>();
    for (const [key, a] of acc) {
        if (a.possible <= 0) continue;
        out.set(key, {
            skill: a.skill,
            earned: Math.round(a.earned * 100) / 100,
            possible: Math.round(a.possible * 100) / 100,
            score: roundScore((100 * a.earned) / a.possible),
            questionIds: a.questionIds,
        });
    }
    return out;
}

// ---------------------------------------------------------------------------
// GitHub evidence per skill
// ---------------------------------------------------------------------------

export interface GithubSkillEvidence {
    skill: string;
    status: ClaimStatus;
    /** `null` when the status is not eligible to score. */
    score: number | null;
    strength: SkillEvidenceStrength;
    evidence: SkillEvidenceRef[];
    conflicts: string[];
    reasons: string[];
    resumeReferences: string[];
}

// Only these evidence types show a technology is used. Language statistics and repository
// metadata are discovery context and are never exposed as skill evidence.
const REF_TYPE: Partial<Record<EvidenceType, SkillEvidenceType>> = {
    dependency: 'dependency',
    source_code: 'source_usage',
    configuration: 'configuration',
    file_presence: 'configuration', // presence of the technology's files / config in the tree
};

// When a duplicate skill has no evidence, keep the most informative status.
const STATUS_PRIORITY: ClaimStatus[] = ['needs_review', 'not_accessible', 'insufficient_evidence', 'not_checked'];

const evidenceIdentity = (key: string, e: Evidence) =>
    [key, e.repository.toLowerCase(), e.evidence_type, e.url ?? e.commit_sha ?? e.path ?? ''].join('|');

/**
 * high   = (dependency or configuration) plus source usage
 * medium = source usage or configuration without that corroboration
 * low    = a dependency declaration or file presence alone
 * unknown = no meaningful evidence (language statistics alone, nothing found, or not eligible)
 */
export function evidenceStrengthOf(evidence: Evidence[]): SkillEvidenceStrength {
    const types = new Set(evidence.map((e) => e.evidence_type));
    const source = types.has('source_code');
    const config = types.has('configuration');
    const dependency = types.has('dependency');
    if (source && (dependency || config)) return 'high';
    if (source || config) return 'medium';
    if (dependency || types.has('file_presence')) return 'low';
    return 'unknown';
}

const toRef = (e: Evidence): SkillEvidenceRef | null => {
    const type = REF_TYPE[e.evidence_type];
    if (!type) return null;
    return {
        type,
        repositoryUrl: `https://github.com/${e.repository}`,
        ...(e.url ? { evidenceUrl: e.url } : {}),
        ...(e.commit_sha ? { commitSha: e.commit_sha } : {}),
    };
};

/**
 * One entry per canonical skill, built from the report's skill claims (the verifier already aggregates
 * evidence across inspected repositories). Duplicate claims for the same skill are merged and their
 * evidence deduplicated, so repeated evidence never inflates the result. Evidence for one technology
 * is never borrowed by another: lookup is by canonical key only.
 */
export function summarizeGithubSkills(report: VerificationReport): Map<string, GithubSkillEvidence> {
    const groups = new Map<string, Claim[]>();
    for (const c of report.claims) {
        if (c.claim_type !== 'skill') continue;
        const key = skillKey(c.claim);
        groups.set(key, [...(groups.get(key) ?? []), c]);
    }

    const out = new Map<string, GithubSkillEvidence>();
    for (const [key, claims] of groups) {
        const seen = new Set<string>();
        const merged: Evidence[] = [];
        for (const c of claims) {
            for (const e of c.evidence) {
                const id = evidenceIdentity(key, e);
                if (!seen.has(id)) {
                    seen.add(id);
                    merged.push(e);
                }
            }
        }

        // A single claim keeps the verifier's own status unchanged; duplicates are re-assessed on the merged evidence.
        let status: ClaimStatus;
        if (claims.length === 1) status = claims[0]!.status;
        else if (merged.length > 0) {
            const support = assessEvidence(merged);
            status = support === 'supported' ? 'supported' : support === 'partial' ? 'partially_supported' : 'insufficient_evidence';
        } else {
            status = STATUS_PRIORITY.find((s) => claims.some((c) => c.status === s)) ?? 'not_checked';
        }

        const score = GITHUB_STATUS_SCORE[status];
        const eligible = score !== null;
        const refs: SkillEvidenceRef[] = [];
        const refSeen = new Set<string>();
        for (const e of merged) {
            const ref = toRef(e);
            const id = ref && `${ref.type}|${ref.repositoryUrl}|${ref.evidenceUrl ?? ''}|${ref.commitSha ?? ''}`;
            if (ref && id && !refSeen.has(id)) {
                refSeen.add(id);
                refs.push(ref);
            }
        }

        out.set(key, {
            skill: claims[0]!.claim,
            status,
            score,
            strength: eligible ? evidenceStrengthOf(merged) : 'unknown',
            evidence: eligible ? refs : [],
            conflicts: eligible ? conflictsFor(key, report) : [],
            reasons: [...new Set(claims.flatMap((c) => c.limitations))],
            resumeReferences: [...new Set(claims.flatMap((c) => c.resume_references))],
        });
    }
    return out;
}

// A project whose repository was inspected but showed no sign of this technology.
function conflictsFor(key: string, report: VerificationReport): string[] {
    const out: string[] = [];
    for (const c of report.claims) {
        if (c.claim_type !== 'project' || !c.repository) continue;
        for (const t of c.technologies ?? []) {
            if (skillKey(t.technology) === key && t.status === 'insufficient_evidence') {
                out.push(`Project "${c.claim}" lists ${t.technology}, but no evidence of it was found in ${c.repository}.`);
            }
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// Combined score
// ---------------------------------------------------------------------------

/**
 * Both available: 0.8 * assessment + 0.2 * github. GitHub unavailable: the assessment score alone.
 * No assessment score: `null`, even if GitHub evidence exists (evidence-only is not a competence score).
 */
export function combineScores(assessmentScore: number | null, githubScore: number | null): number | null {
    if (assessmentScore === null) return null;
    if (githubScore === null) return roundScore(assessmentScore);
    return roundScore(SCORE_WEIGHTS.assessment * assessmentScore + SCORE_WEIGHTS.github * githubScore);
}

export const githubReportState = (report: VerificationReport): GithubReportState => (report.incomplete ? 'incomplete' : 'completed');

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Verification verdict
// ---------------------------------------------------------------------------

/**
 * Decides, from the two independent evidence sources, whether a resume skill is backed by evidence.
 * Missing evidence is never treated as a failed assessment: it yields `unverified`, not `unsupported`.
 */
export function verifySkill(assessmentScore: number | null, githubScore: number | null, githubStatus: GithubSkillStatus): SkillVerification {
    const { pass, fail } = VERIFICATION_THRESHOLDS;
    const a = assessmentScore;
    const g = githubScore !== null;
    const make = (status: SkillVerificationStatus, reason: string): SkillVerification => ({
        status,
        flagged: status !== 'verified' && status !== 'partially_verified',
        reason,
    });

    if (a !== null && a >= pass && g) return make('verified', `Demonstrated in the assessment (${a}%) and supported by public GitHub evidence.`);
    if (a !== null && a >= pass) return make('partially_verified', `Demonstrated in the assessment (${a}%); no public GitHub evidence was found or available to corroborate it.`);
    if (a !== null && g && a >= fail) return make('partially_verified', `Assessment score is moderate (${a}%) and public GitHub evidence supports it.`);
    if (a !== null && g) return make('needs_review', `Assessment score is low (${a}%) but GitHub shows use of this skill; the evidence disagrees, so review it manually.`);
    if (a !== null) return make('unsupported', `Assessed at ${a}% (below ${pass}%) with no GitHub evidence, so the claim is not supported by the evidence so far. This does not prove it is false.`);
    if (g) return make('partially_verified', 'Supported by public GitHub evidence only; it was not covered by the assessment, so no competence score is given.');
    return make(
        'unverified',
        githubStatus === 'not_run'
            ? 'Not covered by the assessment, and GitHub verification has not been run.'
            : 'Not covered by the assessment, and no GitHub evidence was found or could be checked automatically.',
    );
}

export type VerificationSummary = Record<SkillVerificationStatus, number> & { total: number; flagged: number };

export function summarizeVerification(results: CombinedSkillResult[]): VerificationSummary {
    const s: VerificationSummary = { verified: 0, partially_verified: 0, needs_review: 0, unsupported: 0, unverified: 0, total: results.length, flagged: 0 };
    for (const r of results) {
        s[r.verification.status]++;
        if (r.verification.flagged) s.flagged++;
    }
    return s;
}

export interface BuildInput {
    questions: AssessedQuestion[];
    /** Present only when verification produced a report (state `completed` or `incomplete`). */
    report?: VerificationReport | null;
    reportState: GithubReportState;
    /**
     * Every skill claimed on the resume. When given, each one gets a verdict even if it was not assessed and
     * GitHub has no claim for it, so nothing listed on the resume silently escapes verification.
     */
    resumeSkills?: { name: string; references?: string[] }[];
}

function describe(status: GithubSkillStatus, g: GithubSkillEvidence | undefined, state: GithubReportState): string {
    if (status === 'not_run') {
        return state === 'failed' ? 'GitHub verification could not be completed; GitHub evidence is unavailable.' : 'GitHub verification has not been run.';
    }
    if (!g) return 'This skill was not part of the resume claims checked against GitHub.';
    const repos = new Set(g.evidence.map((e) => e.repositoryUrl)).size;
    const head =
        g.score !== null
            ? `GitHub: ${g.status.replace('_', ' ')}; ${g.evidence.length} evidence item(s) across ${repos} repositor${repos === 1 ? 'y' : 'ies'} (strength: ${g.strength}).`
            : `GitHub: ${g.status.replace(/_/g, ' ')}; not scored (this is not evidence the skill is lacking).`;
    const tail = [...g.conflicts, ...g.reasons.slice(0, 2)];
    return [head, ...tail].join(' ');
}

/** One result per skill on the resume, plus any assessed or GitHub-claimed skill not on it. Assessed skills first. */
export function buildCombinedSkillResults(input: BuildInput): CombinedSkillResult[] {
    const assessed = scoreAssessmentSkills(input.questions);
    const haveReport = !!input.report && (input.reportState === 'completed' || input.reportState === 'incomplete');
    const github = haveReport ? summarizeGithubSkills(input.report!) : new Map<string, GithubSkillEvidence>();

    const resume = new Map<string, { name: string; references: string[] }>();
    for (const s of input.resumeSkills ?? []) {
        const key = skillKey(s.name);
        const cur = resume.get(key) ?? { name: s.name.trim(), references: [] };
        for (const r of s.references ?? []) if (!cur.references.includes(r)) cur.references.push(r);
        if (cur.name) resume.set(key, cur);
    }

    const keys = [...new Set([...resume.keys(), ...assessed.keys(), ...github.keys()])];
    const results = keys.map((key): CombinedSkillResult => {
        const a = assessed.get(key);
        const g = github.get(key);
        const r = resume.get(key);
        const githubStatus: GithubSkillStatus = !haveReport ? 'not_run' : (g?.status ?? 'not_checked');
        const assessmentScore = a?.score ?? null;
        const githubScore = g?.score ?? null;
        return {
            skill: r?.name ?? a?.skill ?? g?.skill ?? key,
            assessmentScore,
            githubEvidenceScore: githubScore,
            combinedScore: combineScores(assessmentScore, githubScore),
            verification: verifySkill(assessmentScore, githubScore, githubStatus),
            assessmentQuestionIds: a?.questionIds ?? [],
            githubStatus,
            evidenceStrength: g?.strength ?? 'unknown',
            evidenceSummary: describe(githubStatus, g, input.reportState),
            evidenceUrls: [...new Set((g?.evidence ?? []).map((e) => e.evidenceUrl).filter((u): u is string => !!u))],
            assessmentPoints: a ? { earned: a.earned, possible: a.possible } : null,
            evidence: g?.evidence ?? [],
            conflicts: g?.conflicts ?? [],
            resumeReferences: [...new Set([...(r?.references ?? []), ...(g?.resumeReferences ?? [])])],
        };
    });

    return results.sort(
        (x, y) =>
            Number(y.assessmentScore !== null) - Number(x.assessmentScore !== null) ||
            (y.combinedScore ?? -1) - (x.combinedScore ?? -1) ||
            x.skill.localeCompare(y.skill),
    );
}
