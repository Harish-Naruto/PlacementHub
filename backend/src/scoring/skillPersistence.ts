// ---------------------------------------------------------------------------
// Persist per-skill verification into StudentSkill + SkillEvidence.
//
// planSkillPersistence() is pure: it turns scored results into the rows to write.
// applySkillPlan() runs a plan against a small repository interface (Prisma in production,
// an in-memory fake in tests), so a failure on one skill never blocks the others.
//
// Mapping (documented here, change it here only):
//   StudentSkill.verificationStatus
//     verified                          -> EVALUATED
//     partially_verified, assessment>=60 -> EVALUATED         (the assessment demonstrated it)
//     partially_verified, otherwise     -> REPOSITORY_OBSERVED (GitHub evidence, or a moderate assessment)
//     needs_review | unsupported        -> NEEDS_REVIEW
//     unverified                        -> unchanged (never downgrade what an earlier run established)
//   SkillEvidence
//     one ASSESSMENT row per skill per session (key: assessment:{sessionId})
//         score >= 60 -> EVALUATED, 40-59 -> OBSERVED, < 40 -> REJECTED (evaluated, did not support the claim)
//     one GITHUB_REPOSITORY row per evidence item (key: its commit-pinned file URL), status OBSERVED
//   Rows are upserted by (studentSkill, sourceType, sourceUrl), so re-running never duplicates evidence.
// ---------------------------------------------------------------------------

import { type CombinedSkillResult, VERIFICATION_THRESHOLDS } from './skillScoring.ts';

// Values mirror the Prisma enums (kept as literals so this module has no database dependency).
export type StudentSkillStatus = 'SELF_DECLARED' | 'REPOSITORY_OBSERVED' | 'EVALUATED' | 'NEEDS_REVIEW';
export type EvidenceSource = 'ASSESSMENT' | 'GITHUB_REPOSITORY';
export type EvidenceRowStatus = 'OBSERVED' | 'EVALUATED' | 'REJECTED';

export interface PlannedEvidence {
    sourceType: EvidenceSource;
    sourceUrl: string;
    description: string;
    status: EvidenceRowStatus;
}

export interface PlannedSkill {
    skill: string;
    /** `null` = leave the existing status alone. */
    verificationStatus: StudentSkillStatus | null;
    evidence: PlannedEvidence[];
}

const TYPE_LABEL: Record<string, string> = {
    dependency: 'Dependency declared',
    source_usage: 'Source code usage',
    configuration: 'Configuration / files',
    contribution: 'Contribution',
};

export const assessmentSourceUrl = (sessionId: string) => `assessment:${sessionId}`;

export function studentSkillStatusFor(r: CombinedSkillResult): StudentSkillStatus | null {
    switch (r.verification.status) {
        case 'verified':
            return 'EVALUATED';
        case 'partially_verified':
            return r.assessmentScore !== null && r.assessmentScore >= VERIFICATION_THRESHOLDS.pass ? 'EVALUATED' : 'REPOSITORY_OBSERVED';
        case 'needs_review':
        case 'unsupported':
            return 'NEEDS_REVIEW';
        case 'unverified':
            return null;
    }
}

const assessmentRowStatus = (score: number): EvidenceRowStatus =>
    score >= VERIFICATION_THRESHOLDS.pass ? 'EVALUATED' : score >= VERIFICATION_THRESHOLDS.fail ? 'OBSERVED' : 'REJECTED';

export function planSkillPersistence(results: CombinedSkillResult[], ctx: { sessionId: string }): PlannedSkill[] {
    return results.map((r): PlannedSkill => {
        const evidence: PlannedEvidence[] = [];

        if (r.assessmentScore !== null) {
            const pts = r.assessmentPoints ? ` (${r.assessmentPoints.earned}/${r.assessmentPoints.possible} pts)` : '';
            const qs = r.assessmentQuestionIds.length ? `; questions ${r.assessmentQuestionIds.join(', ')}` : '';
            evidence.push({
                sourceType: 'ASSESSMENT',
                sourceUrl: assessmentSourceUrl(ctx.sessionId),
                description: `AI assessment score ${r.assessmentScore}%${pts}${qs}`,
                status: assessmentRowStatus(r.assessmentScore),
            });
        }

        const seen = new Set<string>();
        for (const e of r.evidence) {
            const url = (e.evidenceUrl ?? e.repositoryUrl).slice(0, 2048);
            if (seen.has(url)) continue;
            seen.add(url);
            const repo = e.repositoryUrl.replace(/^https?:\/\/github\.com\//, '');
            evidence.push({
                sourceType: 'GITHUB_REPOSITORY',
                sourceUrl: url,
                description: `${TYPE_LABEL[e.type] ?? e.type} in ${repo}${e.commitSha ? ` @${e.commitSha.slice(0, 7)}` : ''} (GitHub evidence strength: ${r.evidenceStrength})`,
                status: 'OBSERVED',
            });
        }

        return { skill: r.skill, verificationStatus: studentSkillStatusFor(r), evidence };
    });
}

// ---------------------------------------------------------------------------
// Applying a plan
// ---------------------------------------------------------------------------

export interface SkillEvidenceRepo {
    /** The student's profile id, created if missing. */
    getProfileId(userId: string): Promise<string>;
    /** Skill id for a name or alias, created if unknown. */
    resolveSkillId(name: string): Promise<string>;
    /** The student's StudentSkill for the skill, created as SELF_DECLARED if missing. */
    ensureStudentSkill(profileId: string, skillId: string): Promise<{ id: string; verificationStatus: StudentSkillStatus }>;
    setVerificationStatus(studentSkillId: string, status: StudentSkillStatus): Promise<void>;
    /** Insert, or update description/status of the row with the same (studentSkill, sourceType, sourceUrl). */
    upsertEvidence(studentSkillId: string, evidence: PlannedEvidence): Promise<'created' | 'updated'>;
}

export interface PersistenceSummary {
    skills: number;
    evidenceCreated: number;
    evidenceUpdated: number;
    statusesChanged: number;
    failed: number;
}

export async function applySkillPlan(repo: SkillEvidenceRepo, userId: string, plan: PlannedSkill[]): Promise<PersistenceSummary> {
    const summary: PersistenceSummary = { skills: 0, evidenceCreated: 0, evidenceUpdated: 0, statusesChanged: 0, failed: 0 };
    const profileId = await repo.getProfileId(userId);

    for (const item of plan) {
        try {
            const skillId = await repo.resolveSkillId(item.skill);
            const studentSkill = await repo.ensureStudentSkill(profileId, skillId);
            if (item.verificationStatus && item.verificationStatus !== studentSkill.verificationStatus) {
                await repo.setVerificationStatus(studentSkill.id, item.verificationStatus);
                summary.statusesChanged++;
            }
            for (const e of item.evidence) {
                const outcome = await repo.upsertEvidence(studentSkill.id, e);
                if (outcome === 'created') summary.evidenceCreated++;
                else summary.evidenceUpdated++;
            }
            summary.skills++;
        } catch {
            summary.failed++; // one bad skill must not stop the rest
        }
    }
    return summary;
}
