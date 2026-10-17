import { describe, expect, test } from 'bun:test';
import { buildSkillScores, getGradedSession } from '../src/assessment/skillScores';
import { createSession } from '../src/assessment/store';
import type { AssessmentSession, Scorecard } from '../src/assessment/types';
import type { Claim, ClaimStatus, Evidence, VerificationReport } from '../src/github/types';
import {
    buildCombinedSkillResults,
    combineScores,
    evidenceStrengthOf,
    GITHUB_STATUS_SCORE,
    roundScore,
    scoreAssessmentSkills,
    skillKey,
    summarizeGithubSkills,
    summarizeVerification,
    verifySkill,
} from '../src/scoring/skillScoring';
import { ApiError } from '../src/utils/apiError';

// ---- fixtures ---------------------------------------------------------------------------------

const q = (skill: string, awardedPoints: number, maxPoints: number, skills?: string[]) => ({ skill, awardedPoints, maxPoints, skills });

const ev = (type: Evidence['evidence_type'], repo = 'alice/app', path: string | null = 'src/a.ts', strength: Evidence['strength'] = 'moderate'): Evidence => ({
    evidence_type: type,
    repository: repo,
    path,
    url: path ? `https://github.com/${repo}/blob/abc123/${path}` : `https://github.com/${repo}`,
    commit_sha: 'abc123',
    observation: 'generated observation',
    strength,
});

const skillClaim = (claim: string, status: ClaimStatus, evidence: Evidence[] = [], extra: Partial<Claim> = {}): Claim => ({
    claim_type: 'skill',
    claim,
    status,
    confidence: null,
    resume_references: [`Listed skill (${claim})`],
    evidence,
    limitations: [],
    ...extra,
});

const SUPPORTED_EVIDENCE = [ev('dependency', 'alice/app', 'package.json'), ev('source_code', 'alice/app', 'src/App.tsx', 'strong')];

const report = (claims: Claim[], over: Partial<VerificationReport> = {}): VerificationReport => ({
    github_profile: { username: 'alice', profile_url: 'https://github.com/alice', access_mode: 'public', username_source: 'request', checked_at: '2026-01-01T00:00:00.000Z' },
    repositories: [],
    claims,
    summary: { supported: 0, partially_supported: 0, insufficient_evidence: 0, needs_review: 0, not_accessible: 0, not_checked: 0 },
    limitations: [],
    incomplete: false,
    assessment_score_changed: false,
    ...over,
});

const find = (rs: ReturnType<typeof buildCombinedSkillResults>, skill: string) => rs.find((r) => r.skill === skill)!;

// ---- assessment score -------------------------------------------------------------------------

describe('assessment score per skill', () => {
    test('uses total earned / total possible, not an average of percentages', () => {
        // 4/4 (100%) and 0/12 (0%): average of percentages = 50, weighted by marks = 4/16 = 25.
        const s = scoreAssessmentSkills([q('React', 4, 4), q('React', 0, 12)]);
        expect(s.get('react')!.score).toBe(25);
        expect(s.get('react')).toMatchObject({ earned: 4, possible: 16 });
    });

    test('a skill with no mapped questions has no score (null, not zero)', () => {
        const s = scoreAssessmentSkills([q('React', 5, 10)]);
        expect(s.has('typescript')).toBe(false);
        const results = buildCombinedSkillResults({ questions: [q('React', 5, 10)], reportState: 'not_run' });
        expect(results.find((r) => r.skill === 'TypeScript')).toBeUndefined();
    });

    test('multi-skill questions split earned and possible marks equally', () => {
        const s = scoreAssessmentSkills([q('React', 6, 12, ['React', 'TypeScript'])]);
        expect(s.get('react')).toMatchObject({ earned: 3, possible: 6, score: 50 });
        expect(s.get('typescript')).toMatchObject({ earned: 3, possible: 6, score: 50 });
    });

    test('duplicate aliases inside one question are not double counted', () => {
        const s = scoreAssessmentSkills([q('React', 10, 10, ['React', 'react.js', 'ReactJS'])]);
        expect(s.size).toBe(1);
        expect(s.get('react')).toMatchObject({ earned: 10, possible: 10 });
    });

    test('scores are bounded and rounded; bad inputs are ignored', () => {
        expect(scoreAssessmentSkills([q('A', 99, 10)]).get('a')!.score).toBe(100); // awarded clamped to max
        expect(scoreAssessmentSkills([q('A', -5, 10)]).get('a')!.score).toBe(0);
        expect(scoreAssessmentSkills([q('A', 1, 3)]).get('a')!.score).toBe(33);
        expect(scoreAssessmentSkills([q('A', 5, 0)]).size).toBe(0);
        expect(scoreAssessmentSkills([q('A', Number.NaN, 10)]).get('a')!.score).toBe(0);
        expect(roundScore(150)).toBe(100);
        expect(roundScore(-3)).toBe(0);
    });

    test('aliases map to the same canonical skill', () => {
        expect(skillKey('ReactJS')).toBe(skillKey('React'));
        expect(skillKey('nodejs')).toBe('node.js');
        const s = scoreAssessmentSkills([q('React', 5, 10), q('reactjs', 10, 10)]);
        expect(s.size).toBe(1);
        expect(s.get('react')).toMatchObject({ earned: 15, possible: 20, score: 75 });
    });
});

// ---- GitHub evidence --------------------------------------------------------------------------

describe('GitHub evidence score', () => {
    test('status mapping: supported 100, partial 60, everything else null', () => {
        expect(GITHUB_STATUS_SCORE).toEqual({
            supported: 100,
            partially_supported: 60,
            insufficient_evidence: null,
            needs_review: null,
            not_accessible: null,
            not_checked: null,
        });
        const statuses: ClaimStatus[] = ['supported', 'partially_supported', 'insufficient_evidence', 'needs_review', 'not_accessible', 'not_checked'];
        const g = summarizeGithubSkills(report(statuses.map((s) => skillClaim(`Skill-${s}`, s))));
        expect([...g.values()].map((x) => x.score)).toEqual([100, 60, null, null, null, null]);
    });

    test('duplicate claims and repeated evidence do not inflate the result', () => {
        const dup = [skillClaim('React', 'partially_supported', [ev('dependency', 'alice/app', 'package.json')]), skillClaim('reactjs', 'partially_supported', [ev('dependency', 'alice/app', 'package.json')])];
        const g = summarizeGithubSkills(report(dup)).get('react')!;
        expect(g.score).toBe(60);
        expect(g.evidence).toHaveLength(1);
        expect(g.resumeReferences).toHaveLength(2);
    });

    test('duplicate claims with complementary evidence are re-assessed on the merged, deduplicated evidence', () => {
        const dup = [skillClaim('React', 'partially_supported', [ev('dependency', 'alice/app', 'package.json')]), skillClaim('React', 'partially_supported', [ev('source_code', 'alice/app', 'src/App.tsx', 'strong')])];
        const g = summarizeGithubSkills(report(dup)).get('react')!;
        expect(g.status).toBe('supported');
        expect(g.score).toBe(100);
        expect(g.strength).toBe('high');
    });

    test('React evidence is not counted as TypeScript evidence', () => {
        const r = report([skillClaim('React', 'supported', SUPPORTED_EVIDENCE), skillClaim('TypeScript', 'insufficient_evidence')]);
        const rs = buildCombinedSkillResults({ questions: [q('React', 8, 10), q('TypeScript', 8, 10)], report: r, reportState: 'completed' });
        expect(find(rs, 'React').githubEvidenceScore).toBe(100);
        expect(find(rs, 'TypeScript').githubEvidenceScore).toBeNull();
        expect(find(rs, 'TypeScript').evidence).toEqual([]);
        expect(find(rs, 'TypeScript').combinedScore).toBe(80); // assessment alone
    });

    test('evidence strength follows the documented guidance', () => {
        expect(evidenceStrengthOf([ev('dependency'), ev('source_code')])).toBe('high');
        expect(evidenceStrengthOf([ev('configuration'), ev('source_code')])).toBe('high');
        expect(evidenceStrengthOf([ev('source_code')])).toBe('medium');
        expect(evidenceStrengthOf([ev('configuration')])).toBe('medium');
        expect(evidenceStrengthOf([ev('dependency')])).toBe('low');
        expect(evidenceStrengthOf([ev('language_statistics', 'a/b', null, 'weak')])).toBe('unknown');
        expect(evidenceStrengthOf([])).toBe('unknown');
    });

    test('language statistics and repository metadata are never exposed as skill evidence', () => {
        const r = report([skillClaim('React', 'partially_supported', [ev('language_statistics', 'alice/app', null, 'weak'), ev('repository_metadata', 'alice/app', null), ev('dependency', 'alice/app', 'package.json')])]);
        const g = summarizeGithubSkills(r).get('react')!;
        expect(g.evidence.map((e) => e.type)).toEqual(['dependency']);
    });

    test('evidence refs keep repository, evidence url and commit sha', () => {
        const g = summarizeGithubSkills(report([skillClaim('React', 'supported', SUPPORTED_EVIDENCE)])).get('react')!;
        expect(g.evidence).toContainEqual({
            type: 'source_usage',
            repositoryUrl: 'https://github.com/alice/app',
            evidenceUrl: 'https://github.com/alice/app/blob/abc123/src/App.tsx',
            commitSha: 'abc123',
        });
    });

    test('a project repo that was inspected without the technology is surfaced as a conflict, not hidden', () => {
        const project: Claim = {
            claim_type: 'project',
            claim: 'Web-Escape',
            status: 'partially_supported',
            confidence: null,
            resume_references: ['Project: Web-Escape'],
            evidence: [],
            limitations: [],
            repository: 'alice/web-escape',
            technologies: [{ technology: 'React', status: 'insufficient_evidence' }],
        };
        const g = summarizeGithubSkills(report([skillClaim('React', 'supported', SUPPORTED_EVIDENCE), project])).get('react')!;
        expect(g.score).toBe(100);
        expect(g.conflicts[0]).toContain('Web-Escape');
    });

    test('forks and review statuses keep their existing behaviour (needs_review stays unscored)', () => {
        const rs = buildCombinedSkillResults({
            questions: [q('React', 8, 10)],
            report: report([skillClaim('React', 'needs_review', [], { limitations: ['All evidence comes from forked repositories.'] })]),
            reportState: 'completed',
        });
        expect(find(rs, 'React')).toMatchObject({ githubStatus: 'needs_review', githubEvidenceScore: null, combinedScore: 80, evidenceStrength: 'unknown' });
        expect(find(rs, 'React').evidenceSummary).toContain('forked');
    });
});

// ---- combined score ---------------------------------------------------------------------------

describe('combined score', () => {
    test('formula: 80/20 when both exist', () => {
        expect(combineScores(80, 100)).toBe(84);
        expect(combineScores(80, 60)).toBe(76);
        expect(combineScores(0, 100)).toBe(20);
        expect(combineScores(100, 100)).toBe(100);
    });

    test('GitHub unavailable: assessment alone, not penalised', () => {
        expect(combineScores(80, null)).toBe(80);
    });

    test('missing assessment: null even when GitHub evidence exists (evidence-only state)', () => {
        expect(combineScores(null, 100)).toBeNull();
        expect(combineScores(null, null)).toBeNull();
    });

    test('rounding is to the nearest integer within 0-100', () => {
        expect(combineScores(33, 60)).toBe(roundScore(0.8 * 33 + 0.2 * 60)); // 38.4 -> 38
        expect(combineScores(33, 60)).toBe(38);
        expect(combineScores(99, 100)).toBe(99); // 99.2
    });

    test('github-only skills are reported with a null combined score', () => {
        const rs = buildCombinedSkillResults({ questions: [q('React', 8, 10)], report: report([skillClaim('Docker', 'supported', SUPPORTED_EVIDENCE)]), reportState: 'completed' });
        expect(find(rs, 'Docker')).toMatchObject({ assessmentScore: null, githubEvidenceScore: 100, combinedScore: null });
    });

    test('an assessed skill the report did not check is not_checked, not penalised', () => {
        const rs = buildCombinedSkillResults({ questions: [q('Kubernetes', 5, 10)], report: report([]), reportState: 'completed' });
        expect(find(rs, 'Kubernetes')).toMatchObject({ githubStatus: 'not_checked', combinedScore: 50 });
    });

    test('assessed skills are listed first, best combined score first', () => {
        const rs = buildCombinedSkillResults({
            questions: [q('A', 5, 10), q('B', 9, 10)],
            report: report([skillClaim('Docker', 'supported', SUPPORTED_EVIDENCE)]),
            reportState: 'completed',
        });
        expect(rs.map((r) => r.skill)).toEqual(['B', 'A', 'Docker']);
    });
});

// ---- failure handling and composition ---------------------------------------------------------

describe('GitHub unavailable states', () => {
    test('not_run and failed produce assessment-only scores with githubStatus not_run', () => {
        for (const state of ['not_run', 'failed'] as const) {
            const rs = buildCombinedSkillResults({ questions: [q('React', 8, 10)], report: null, reportState: state });
            expect(find(rs, 'React')).toMatchObject({ githubStatus: 'not_run', githubEvidenceScore: null, combinedScore: 80 });
        }
    });

    test('an incomplete report does not turn missing evidence into zero', () => {
        // The verifier marks skills it could not examine as not_accessible when the run was incomplete.
        const r = report([skillClaim('React', 'not_accessible'), skillClaim('Redis', 'partially_supported', [ev('dependency')])], { incomplete: true });
        const rs = buildCombinedSkillResults({ questions: [q('React', 8, 10), q('Redis', 8, 10)], report: r, reportState: 'incomplete' });
        expect(find(rs, 'React')).toMatchObject({ githubEvidenceScore: null, combinedScore: 80 });
        expect(find(rs, 'Redis')).toMatchObject({ githubEvidenceScore: 60, combinedScore: 76 });
    });
});

const scorecard = (questionResults: Scorecard['questionResults']): Scorecard => ({
    sessionId: 's',
    resumeId: 'r',
    totalPoints: 0,
    maxPoints: 0,
    percentage: 0,
    grade: 'F',
    skillBreakdown: [],
    questionResults,
    summary: '',
    strengths: [],
    improvements: [],
    completedAt: new Date().toISOString(),
});

const graded = (id: string, withScorecard = true): AssessmentSession => {
    const session: AssessmentSession = {
        id,
        userId: 'u1',
        resumeId: 'r1',
        skills: ['React'],
        questions: [],
        answers: new Map(),
        status: withScorecard ? 'GRADED' : 'ACTIVE',
        timeLimit: 1800,
        startedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        ...(withScorecard
            ? { scorecard: scorecard([{ questionId: 'q-0', skill: 'React', type: 'MCQ', difficulty: 'EASY', maxPoints: 10, awardedPoints: 8, feedback: '' }]) }
            : {}),
    };
    createSession(session);
    return session;
};

describe('buildSkillScores (composition layer)', () => {
    test('without verification, returns assessment-only scores', async () => {
        const res = await buildSkillScores(graded('sess-a'));
        expect(res.github.state).toBe('not_run');
        expect(res.skills[0]).toMatchObject({ skill: 'React', assessmentScore: 80, combinedScore: 80, githubStatus: 'not_run' });
        expect(res.weights).toEqual({ assessment: 0.8, github: 0.2 });
    });

    test('runs the verifier on request and combines the result', async () => {
        const session = graded('sess-b');
        const res = await buildSkillScores(session, async () => report([skillClaim('React', 'supported', SUPPORTED_EVIDENCE)]));
        expect(res.github).toMatchObject({ state: 'completed', username: 'alice' });
        expect(res.skills[0]).toMatchObject({ assessmentScore: 80, githubEvidenceScore: 100, combinedScore: 84 });
        // A later GET reuses the stored report without calling GitHub again.
        const again = await buildSkillScores(session);
        expect(again.skills[0]!.combinedScore).toBe(84);
    });

    test('a GitHub failure never fails the request and is not cached as a negative result', async () => {
        const session = graded('sess-c');
        const failing = async () => {
            throw new ApiError('GitHub rate limit reached; please try again later', 503, true, 'GITHUB_RATE_LIMITED');
        };
        const res = await buildSkillScores(session, failing);
        expect(res.github).toMatchObject({ state: 'failed', error: { code: 'GITHUB_RATE_LIMITED' } });
        expect(res.skills[0]).toMatchObject({ assessmentScore: 80, combinedScore: 80, githubStatus: 'not_run' });
        expect(session.githubReport).toBeUndefined();

        const unexpected = await buildSkillScores(session, async () => {
            throw new Error('boom with secret details');
        });
        expect(unexpected.github.error).toEqual({ code: 'GITHUB_VERIFICATION_FAILED', message: 'GitHub verification failed unexpectedly' });
    });

    test('a failed re-run keeps the earlier successful report', async () => {
        const session = graded('sess-d');
        await buildSkillScores(session, async () => report([skillClaim('React', 'partially_supported', [ev('dependency')])]));
        const res = await buildSkillScores(session, async () => {
            throw new ApiError('GitHub is unavailable', 502, true, 'GITHUB_UNAVAILABLE');
        });
        expect(res.github.state).toBe('completed');
        expect(res.github.error?.code).toBe('GITHUB_UNAVAILABLE');
        expect(res.skills[0]!.githubEvidenceScore).toBe(60);
    });

    test('an incomplete report is labelled incomplete', async () => {
        const res = await buildSkillScores(graded('sess-e'), async () => report([skillClaim('React', 'not_accessible')], { incomplete: true }));
        expect(res.github.state).toBe('incomplete');
        expect(res.skills[0]).toMatchObject({ githubEvidenceScore: null, combinedScore: 80 });
    });

    test('only the owner can read a graded session, and it must be graded', () => {
        graded('sess-f');
        graded('sess-g', false);
        expect(() => getGradedSession('someone-else', 'sess-f')).toThrow('Unauthorized');
        expect(() => getGradedSession('u1', 'sess-g')).toThrow('not been graded');
        expect(() => getGradedSession('u1', 'missing')).toThrow('not found');
        expect(getGradedSession('u1', 'sess-f').id).toBe('sess-f');
    });
});

// ---- verification verdicts (every resume skill) -----------------------------------------------

describe('skill verification verdict', () => {
    test('both sources agree -> verified', () => {
        expect(verifySkill(80, 100, 'supported')).toMatchObject({ status: 'verified', flagged: false });
        expect(verifySkill(60, 60, 'partially_supported').status).toBe('verified');
    });

    test('one positive source -> partially_verified (not flagged)', () => {
        expect(verifySkill(80, null, 'insufficient_evidence')).toMatchObject({ status: 'partially_verified', flagged: false });
        expect(verifySkill(null, 100, 'supported')).toMatchObject({ status: 'partially_verified', flagged: false });
        expect(verifySkill(50, 60, 'partially_supported').status).toBe('partially_verified');
    });

    test('low assessment but GitHub shows use -> needs_review (flagged)', () => {
        expect(verifySkill(20, 100, 'supported')).toMatchObject({ status: 'needs_review', flagged: true });
    });

    test('assessed and not demonstrated, no GitHub evidence -> unsupported (flagged, not "false")', () => {
        const v = verifySkill(30, null, 'insufficient_evidence');
        expect(v).toMatchObject({ status: 'unsupported', flagged: true });
        expect(v.reason).toContain('does not prove it is false');
        expect(verifySkill(55, null, 'not_run').status).toBe('unsupported');
    });

    test('no evidence either way -> unverified (flagged), distinct from unsupported', () => {
        expect(verifySkill(null, null, 'not_run')).toMatchObject({ status: 'unverified', flagged: true });
        expect(verifySkill(null, null, 'not_checked').reason).toContain('could be checked automatically');
        expect(verifySkill(null, null, 'needs_review').status).toBe('unverified');
    });
});

describe('every skill on the resume gets a verdict', () => {
    const resumeSkills = [
        { name: 'React', references: ['Listed skill (Frontend)'] },
        { name: 'ReactJS', references: ['Project: Web-Escape'] }, // alias of React: one result
        { name: 'Redis' },
        { name: 'VS Code' },
        { name: 'Kubernetes' },
    ];

    test('unassessed skills are listed and flagged, aliases are merged, references are kept', () => {
        const rs = buildCombinedSkillResults({
            questions: [{ id: 'q-0', skill: 'React', awardedPoints: 8, maxPoints: 10 }, { id: 'q-1', skill: 'Redis', awardedPoints: 2, maxPoints: 10 }],
            report: report([skillClaim('React', 'supported', SUPPORTED_EVIDENCE), skillClaim('Redis', 'insufficient_evidence'), skillClaim('VS Code', 'not_checked')]),
            reportState: 'completed',
            resumeSkills,
        });
        expect(rs.map((r) => r.skill).sort()).toEqual(['Kubernetes', 'React', 'Redis', 'VS Code']);

        const react = find(rs, 'React');
        expect(react.verification.status).toBe('verified');
        expect(react.resumeReferences).toEqual(expect.arrayContaining(['Listed skill (Frontend)', 'Project: Web-Escape']));
        expect(react.assessmentQuestionIds).toEqual(['q-0']); // assessment proof
        expect(react.evidenceUrls.length).toBeGreaterThan(0); // GitHub proof

        expect(find(rs, 'Redis').verification.status).toBe('unsupported'); // assessed 20%, nothing on GitHub
        expect(find(rs, 'VS Code').verification.status).toBe('unverified'); // no automated check
        expect(find(rs, 'Kubernetes')).toMatchObject({ githubStatus: 'not_checked', assessmentScore: null, combinedScore: null });
        expect(find(rs, 'Kubernetes').verification.flagged).toBe(true);

        expect(summarizeVerification(rs)).toEqual({ verified: 1, partially_verified: 0, needs_review: 0, unsupported: 1, unverified: 2, total: 4, flagged: 3 });
    });

    test('without a GitHub report, resume skills are still listed (assessed ones partially verified)', () => {
        const rs = buildCombinedSkillResults({ questions: [{ skill: 'React', awardedPoints: 9, maxPoints: 10 }], report: null, reportState: 'not_run', resumeSkills });
        expect(find(rs, 'React')).toMatchObject({ githubStatus: 'not_run', combinedScore: 90 });
        expect(find(rs, 'React').verification.status).toBe('partially_verified');
        expect(find(rs, 'Redis').verification.reason).toContain('has not been run');
    });

    test('buildSkillScores reports the summary and covers all resume skills', async () => {
        const res = await buildSkillScores(graded('sess-h'), async () => report([skillClaim('React', 'supported', SUPPORTED_EVIDENCE)]), resumeSkills);
        expect(res.verification).toMatchObject({ total: 4, verified: 1, flagged: 3 });
        expect(res.thresholds).toEqual({ pass: 60, fail: 40 });
        expect(res.skills.find((s) => s.skill === 'React')!.verification.status).toBe('verified');
    });
});
