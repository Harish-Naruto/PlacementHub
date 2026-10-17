import { describe, expect, test } from 'bun:test';
import {
    applySkillPlan,
    assessmentSourceUrl,
    planSkillPersistence,
    studentSkillStatusFor,
    type PlannedEvidence,
    type PlannedScores,
    type SkillEvidenceRepo,
    type StudentSkillStatus,
} from '../src/scoring/skillPersistence';
import { buildCombinedSkillResults, type CombinedSkillResult } from '../src/scoring/skillScoring';
import type { Claim, Evidence, VerificationReport } from '../src/github/types';

// ---- fixtures ---------------------------------------------------------------------------------

const ev = (type: Evidence['evidence_type'], path: string, repo = 'alice/app'): Evidence => ({
    evidence_type: type,
    repository: repo,
    path,
    url: `https://github.com/${repo}/blob/abc1234def/${path}`,
    commit_sha: 'abc1234def',
    observation: 'generated',
    strength: 'strong',
});

const claim = (name: string, status: Claim['status'], evidence: Evidence[] = []): Claim => ({
    claim_type: 'skill',
    claim: name,
    status,
    confidence: null,
    resume_references: [],
    evidence,
    limitations: [],
});

const report = (claims: Claim[]): VerificationReport => ({
    github_profile: { username: 'alice', profile_url: 'https://github.com/alice', access_mode: 'public', username_source: 'request', checked_at: '2026-01-01T00:00:00.000Z' },
    repositories: [],
    claims,
    summary: { supported: 0, partially_supported: 0, insufficient_evidence: 0, needs_review: 0, not_accessible: 0, not_checked: 0 },
    limitations: [],
    incomplete: false,
    assessment_score_changed: false,
});

const results = (): CombinedSkillResult[] =>
    buildCombinedSkillResults({
        questions: [
            { id: 'q-0', skill: 'React', awardedPoints: 9, maxPoints: 10 }, // 90, GitHub supported -> verified
            { id: 'q-1', skill: 'Redis', awardedPoints: 2, maxPoints: 10 }, // 20, nothing on GitHub -> unsupported
            { id: 'q-2', skill: 'Docker', awardedPoints: 7, maxPoints: 10 }, // 70, no GitHub -> partially (assessment)
            { id: 'q-3', skill: 'Go', awardedPoints: 1, maxPoints: 10 }, // 10, GitHub shows use -> needs_review
        ],
        report: report([
            claim('React', 'supported', [ev('dependency', 'package.json'), ev('source_code', 'src/App.tsx')]),
            claim('Redis', 'insufficient_evidence'),
            claim('Go', 'partially_supported', [ev('configuration', 'go.mod')]),
            claim('Python', 'partially_supported', [ev('dependency', 'requirements.txt')]), // github only
        ]),
        reportState: 'completed',
        resumeSkills: [{ name: 'React' }, { name: 'Redis' }, { name: 'Docker' }, { name: 'Go' }, { name: 'Python' }, { name: 'Kubernetes' }],
    });

// ---- in-memory repository ---------------------------------------------------------------------

function fakeRepo(opts: { failOnSkill?: string; existing?: Record<string, StudentSkillStatus> } = {}) {
    const skills = new Map<string, string>(); // name(lower) -> skillId
    const studentSkills = new Map<string, { id: string; skillName: string; verificationStatus: StudentSkillStatus }>();
    const evidence = new Map<string, PlannedEvidence & { studentSkillId: string }>();
    const scores = new Map<string, PlannedScores>(); // studentSkillId -> latest scores
    let seq = 0;
    const nameOf = new Map<string, string>(); // skillId -> name

    const repo: SkillEvidenceRepo = {
        async getProfileId() {
            return 'profile-1';
        },
        async resolveSkillId(name) {
            if (name === opts.failOnSkill) throw new Error('db down for this skill');
            const key = name.toLowerCase();
            if (!skills.has(key)) {
                const id = `skill-${++seq}`;
                skills.set(key, id);
                nameOf.set(id, name);
            }
            return skills.get(key)!;
        },
        async ensureStudentSkill(_profileId, skillId) {
            const name = nameOf.get(skillId)!;
            const found = studentSkills.get(skillId);
            if (found) return found;
            const created = { id: `ss-${++seq}`, skillName: name, verificationStatus: opts.existing?.[name] ?? ('SELF_DECLARED' as StudentSkillStatus) };
            studentSkills.set(skillId, created);
            return created;
        },
        async setVerificationStatus(studentSkillId, status) {
            for (const s of studentSkills.values()) if (s.id === studentSkillId) s.verificationStatus = status;
        },
        async setScores(studentSkillId, s) {
            scores.set(studentSkillId, s);
        },
        async upsertEvidence(studentSkillId, e) {
            const key = `${studentSkillId}|${e.sourceType}|${e.sourceUrl}`;
            const had = evidence.has(key);
            evidence.set(key, { ...e, studentSkillId });
            return had ? 'updated' : 'created';
        },
    };
    const statusOf = (name: string) => [...studentSkills.values()].find((s) => s.skillName === name)?.verificationStatus;
    const evidenceOf = (name: string) => {
        const id = [...studentSkills.values()].find((s) => s.skillName === name)?.id;
        return [...evidence.values()].filter((e) => e.studentSkillId === id);
    };
    const scoresOf = (name: string) => scores.get([...studentSkills.values()].find((s) => s.skillName === name)?.id ?? '');
    return { repo, statusOf, evidenceOf, scoresOf, evidence, studentSkills };
}

// ---- the plan ---------------------------------------------------------------------------------

describe('numeric scores', () => {
    test('the plan carries each skill\x27s assessment, GitHub and combined scores', () => {
        const plan = planSkillPersistence(results(), { sessionId: 'sess-1' });
        expect(plan.find((p) => p.skill === 'React')!.scores).toMatchObject({ assessmentScore: 90, combinedScore: 92, githubScore: 100 });
        expect(plan.find((p) => p.skill === 'Kubernetes')!.scores).toMatchObject({ assessmentScore: null, combinedScore: null });
    });

    test('applying a plan stores the scores through the repository', async () => {
        const { repo, scoresOf } = fakeRepo();
        await applySkillPlan(repo, 'user-1', planSkillPersistence(results(), { sessionId: 'sess-1' }));
        expect(scoresOf('React')).toMatchObject({ assessmentScore: 90, combinedScore: 92 });
    });
});

describe('planSkillPersistence', () => {
    const plan = planSkillPersistence(results(), { sessionId: 'sess-1' });
    const of = (skill: string) => plan.find((p) => p.skill === skill)!;

    test('verdicts map to StudentSkill statuses; unverified leaves the status alone', () => {
        expect(of('React').verificationStatus).toBe('EVALUATED'); // verified
        expect(of('Docker').verificationStatus).toBe('EVALUATED'); // partially, assessment >= 60
        expect(of('Python').verificationStatus).toBe('REPOSITORY_OBSERVED'); // partially, GitHub only
        expect(of('Redis').verificationStatus).toBe('NEEDS_REVIEW'); // unsupported
        expect(of('Go').verificationStatus).toBe('NEEDS_REVIEW'); // needs_review
        expect(of('Kubernetes').verificationStatus).toBeNull(); // unverified
        expect(studentSkillStatusFor(results().find((r) => r.skill === 'Docker')!)).toBe('EVALUATED');
    });

    test('assessment evidence row: keyed by session, status by score band, carries points and question ids', () => {
        const a = of('React').evidence.find((e) => e.sourceType === 'ASSESSMENT')!;
        expect(a).toMatchObject({ sourceUrl: assessmentSourceUrl('sess-1'), status: 'EVALUATED' });
        expect(a.description).toContain('90%');
        expect(a.description).toContain('9/10 pts');
        expect(a.description).toContain('q-0');
        expect(of('Redis').evidence.find((e) => e.sourceType === 'ASSESSMENT')!.status).toBe('REJECTED'); // 20%
        expect(of('Python').evidence.some((e) => e.sourceType === 'ASSESSMENT')).toBe(false); // not assessed
    });

    test('moderate assessment scores (40-59) are OBSERVED', () => {
        const r = buildCombinedSkillResults({ questions: [{ skill: 'Rust', awardedPoints: 5, maxPoints: 10 }], reportState: 'not_run' });
        expect(planSkillPersistence(r, { sessionId: 's' })[0]!.evidence[0]!.status).toBe('OBSERVED');
    });

    test('GitHub evidence rows: commit-pinned file URL, OBSERVED, readable description', () => {
        const rows = of('React').evidence.filter((e) => e.sourceType === 'GITHUB_REPOSITORY');
        expect(rows).toHaveLength(2);
        expect(rows.every((e) => e.status === 'OBSERVED' && e.sourceUrl.includes('/blob/abc1234def/'))).toBe(true);
        expect(rows.map((e) => e.description).join(' ')).toContain('Source code usage in alice/app @abc1234');
    });

    test('skills without any evidence produce no evidence rows', () => {
        expect(of('Kubernetes').evidence).toEqual([]);
    });

    test('duplicate evidence URLs are collapsed', () => {
        const r = results().find((x) => x.skill === 'React')!;
        const doubled = { ...r, evidence: [...r.evidence, ...r.evidence] };
        const p = planSkillPersistence([doubled], { sessionId: 's' })[0]!;
        expect(p.evidence.filter((e) => e.sourceType === 'GITHUB_REPOSITORY')).toHaveLength(2);
    });
});

// ---- applying it ------------------------------------------------------------------------------

describe('applySkillPlan', () => {
    const plan = () => planSkillPersistence(results(), { sessionId: 'sess-1' });

    test('creates StudentSkills, statuses and evidence rows', async () => {
        const f = fakeRepo();
        const summary = await applySkillPlan(f.repo, 'user-1', plan());
        expect(summary).toMatchObject({ skills: 6, failed: 0, evidenceUpdated: 0 });
        expect(summary.evidenceCreated).toBe(f.evidence.size);
        expect(f.statusOf('React')).toBe('EVALUATED');
        expect(f.statusOf('Redis')).toBe('NEEDS_REVIEW');
        expect(f.statusOf('Kubernetes')).toBe('SELF_DECLARED'); // created, status untouched
        expect(f.evidenceOf('React').map((e) => e.sourceType).sort()).toEqual(['ASSESSMENT', 'GITHUB_REPOSITORY', 'GITHUB_REPOSITORY']);
    });

    test('is idempotent: a second run updates in place and adds no rows', async () => {
        const f = fakeRepo();
        await applySkillPlan(f.repo, 'user-1', plan());
        const before = f.evidence.size;
        const second = await applySkillPlan(f.repo, 'user-1', plan());
        expect(f.evidence.size).toBe(before);
        expect(second).toMatchObject({ evidenceCreated: 0, statusesChanged: 0, failed: 0 });
        expect(second.evidenceUpdated).toBe(before);
    });

    test('an unverified skill never downgrades an earlier verified status', async () => {
        const f = fakeRepo({ existing: { Kubernetes: 'EVALUATED' } });
        await applySkillPlan(f.repo, 'user-1', plan());
        expect(f.statusOf('Kubernetes')).toBe('EVALUATED');
    });

    test('a later, lower assessment does update the status (latest evidence wins)', async () => {
        const f = fakeRepo({ existing: { Redis: 'EVALUATED' } });
        await applySkillPlan(f.repo, 'user-1', plan());
        expect(f.statusOf('Redis')).toBe('NEEDS_REVIEW');
    });

    test('a failure on one skill does not block the rest and is counted', async () => {
        const f = fakeRepo({ failOnSkill: 'Docker' });
        const summary = await applySkillPlan(f.repo, 'user-1', plan());
        expect(summary).toMatchObject({ skills: 5, failed: 1 });
        expect(f.statusOf('React')).toBe('EVALUATED');
        expect(f.statusOf('Docker')).toBeUndefined();
    });

    test('a different session adds a new assessment row instead of overwriting the old one', async () => {
        const f = fakeRepo();
        await applySkillPlan(f.repo, 'user-1', plan());
        await applySkillPlan(f.repo, 'user-1', planSkillPersistence(results(), { sessionId: 'sess-2' }));
        const rows = f.evidenceOf('React').filter((e) => e.sourceType === 'ASSESSMENT');
        expect(rows.map((r) => r.sourceUrl).sort()).toEqual(['assessment:sess-1', 'assessment:sess-2']);
    });
});

describe('applySkillPlan concurrency', () => {
    test('works on several skills at once, but never more than the limit', async () => {
        let inFlight = 0;
        let peak = 0;
        const slow = async <T>(v: T): Promise<T> => {
            inFlight++;
            peak = Math.max(peak, inFlight);
            await new Promise((r) => setTimeout(r, 5));
            inFlight--;
            return v;
        };
        const repo: SkillEvidenceRepo = {
            getProfileId: async () => 'p',
            resolveSkillId: (n) => slow(`id-${n}`),
            ensureStudentSkill: (_p, id) => slow({ id, verificationStatus: 'SELF_DECLARED' as StudentSkillStatus }),
            setVerificationStatus: () => slow(undefined),
            upsertEvidence: () => slow('created' as const),
        };
        const plan = Array.from({ length: 20 }, (_, i) => ({
            skill: `S${i}`,
            scores: { assessmentScore: 80, githubScore: null, combinedScore: 80, evidenceStrength: 'unknown' },
            verificationStatus: 'EVALUATED' as StudentSkillStatus,
            evidence: [{ sourceType: 'ASSESSMENT' as const, sourceUrl: `assessment:${i}`, description: 'd', status: 'EVALUATED' as const }],
        }));
        const summary = await applySkillPlan(repo, 'u', plan, 4);
        expect(summary).toMatchObject({ skills: 20, failed: 0, evidenceCreated: 20, statusesChanged: 20 });
        expect(peak).toBeGreaterThan(1); // not serial
        expect(peak).toBeLessThanOrEqual(4 * 2); // 4 workers, each with at most status + evidence writes in flight
    });
});
