import { describe, expect, test } from 'bun:test';
import { bandFor, checkEligibility, computeFit, OBSERVED_ONLY_CAP, type JobInput, type StudentInput, type StudentSkillInput } from '../src/matching/fit';
import { branchKey } from '../src/matching/branches';

const skill = (name: string, combined: number | null, over: Partial<StudentSkillInput> = {}): StudentSkillInput => ({
    skill: name,
    combinedScore: combined,
    assessmentScore: combined,
    githubScore: null,
    status: combined === null ? 'SELF_DECLARED' : 'EVALUATED',
    ...over,
});

const student = (skills: StudentSkillInput[], over: Partial<StudentInput> = {}): StudentInput => ({ cgpa: 8, branch: 'Computer Science', graduationYear: 2026, skills, ...over });
const job = (reqs: JobInput['requirements'], over: Partial<JobInput> = {}): JobInput => ({ requirements: reqs, minCgpa: null, eligibleBranches: [], graduationYears: [], deadline: null, ...over });

describe('fit score', () => {
    test('perfect profile scores 100 and is Strong', () => {
        const r = computeFit(student([skill('React', 100), skill('Node.js', 100)]), job([{ skill: 'React', type: 'REQUIRED' }, { skill: 'Node.js', type: 'PREFERRED' }]));
        expect(r.fitScore).toBe(100);
        expect(r.band).toBe('Strong');
        expect(r.gaps).toEqual([]);
    });

    test('empty profile scores 0 and every skill is a "missing" gap with an action', () => {
        const r = computeFit(student([]), job([{ skill: 'React', type: 'REQUIRED' }]));
        expect(r.fitScore).toBe(0);
        expect(r.gaps[0]).toMatchObject({ skill: 'React', kind: 'missing', requirement: 'REQUIRED' });
        expect(r.gaps[0]!.action).toContain('React');
    });

    test('required outweighs preferred', () => {
        const hasRequired = computeFit(student([skill('React', 100)]), job([{ skill: 'React', type: 'REQUIRED' }, { skill: 'Docker', type: 'PREFERRED' }]));
        const hasPreferred = computeFit(student([skill('Docker', 100)]), job([{ skill: 'React', type: 'REQUIRED' }, { skill: 'Docker', type: 'PREFERRED' }]));
        expect(hasRequired.fitScore).toBe(80); // 1.0 / 1.25
        expect(hasPreferred.fitScore).toBe(20); // 0.25 / 1.25
    });

    test('requirement weight scales the contribution', () => {
        const r = computeFit(student([skill('React', 100)]), job([{ skill: 'React', type: 'REQUIRED', weight: 3 }, { skill: 'SQL', type: 'REQUIRED', weight: 1 }]));
        expect(r.fitScore).toBe(75);
    });

    test('GitHub-only evidence is capped; the skill is a gap, not a match', () => {
        const r = computeFit(student([skill('React', null, { githubScore: 100, status: 'REPOSITORY_OBSERVED' })]), job([{ skill: 'React', type: 'REQUIRED' }]));
        expect(r.fitScore).toBe(Math.round(OBSERVED_ONLY_CAP * 100));
        expect(r.gaps[0]).toMatchObject({ kind: 'observed_only' });
        expect(r.matched).toEqual([]);
    });

    test('self-declared skill earns nothing and is reported as claimed only', () => {
        const r = computeFit(student([skill('React', null)]), job([{ skill: 'React', type: 'REQUIRED' }]));
        expect(r.fitScore).toBe(0);
        expect(r.gaps[0]).toMatchObject({ kind: 'claimed_only' });
    });

    test('a weak score earns partial credit and is a "weak" gap', () => {
        const r = computeFit(student([skill('React', 45, { status: 'NEEDS_REVIEW' })]), job([{ skill: 'React', type: 'REQUIRED' }]));
        expect(r.fitScore).toBe(45);
        expect(r.gaps[0]).toMatchObject({ kind: 'weak' });
    });

    test('aliases match: job says ReactJS, profile says React', () => {
        const r = computeFit(student([skill('React', 80)]), job([{ skill: 'ReactJS', type: 'REQUIRED' }]));
        expect(r.fitScore).toBe(80);
        expect(r.matched[0]!.skill).toBe('React');
    });

    test('React evidence never counts for TypeScript', () => {
        const r = computeFit(student([skill('React', 100)]), job([{ skill: 'TypeScript', type: 'REQUIRED' }]));
        expect(r.fitScore).toBe(0);
    });

    test('a job with no skills has a null score, never 0', () => {
        const r = computeFit(student([skill('React', 100)]), job([]));
        expect(r.fitScore).toBeNull();
        expect(r.band).toBe('Unknown');
        expect(r.explanation).toContain('no skills');
    });

    test('duplicate requirements collapse and required wins', () => {
        const r = computeFit(student([skill('React', 100)]), job([{ skill: 'React', type: 'PREFERRED' }, { skill: 'ReactJS', type: 'REQUIRED' }]));
        expect(r.matched).toHaveLength(1);
        expect(r.matched[0]!.requirement).toBe('REQUIRED');
    });

    test('bands', () => {
        expect(bandFor(70)).toBe('Strong');
        expect(bandFor(69)).toBe('Good');
        expect(bandFor(50)).toBe('Good');
        expect(bandFor(49)).toBe('Partial');
        expect(bandFor(30)).toBe('Partial');
        expect(bandFor(29)).toBe('Low');
        expect(bandFor(null)).toBe('Unknown');
    });
});

describe('explanation', () => {
    test('names demonstrated skills, each required gap, and the eligibility result', () => {
        const r = computeFit(student([skill('React', 84), skill('SQL', null)]), job([{ skill: 'React', type: 'REQUIRED' }, { skill: 'Docker', type: 'REQUIRED' }, { skill: 'SQL', type: 'REQUIRED' }, { skill: 'AWS', type: 'PREFERRED' }]));
        expect(r.explanation).toContain('React (84)');
        expect(r.explanation).toContain('1 of 3 required skills are demonstrated');
        expect(r.explanation).toContain('Docker is not on the profile');
        expect(r.explanation).toContain('SQL is claimed but has no evidence yet');
        expect(r.explanation).toContain('Preferred gaps: AWS');
        expect(r.explanation).toContain('Eligibility checks pass');
    });

    test('never mentions a skill that is not in the inputs', () => {
        const r = computeFit(student([skill('React', 90)]), job([{ skill: 'React', type: 'REQUIRED' }]));
        expect(r.explanation).not.toMatch(/Docker|Python|AWS/);
    });
});

describe('eligibility', () => {
    test('flags do not change the score', () => {
        const base = computeFit(student([skill('React', 100)], { cgpa: 6 }), job([{ skill: 'React', type: 'REQUIRED' }], { minCgpa: 7.5 }));
        expect(base.fitScore).toBe(100);
        expect(base.eligibility.eligible).toBe(false);
        expect(base.eligibility.flags[0]).toContain('below the 7.5 minimum');
        expect(base.explanation).toContain('Not eligible');
    });

    test('branch uses aliases ("CSE" vs "Computer Science and Engineering")', () => {
        expect(branchKey('Computer Science and Engineering')).toBe('cse');
        expect(branchKey('Information Technology')).toBe('it');
        const e = checkEligibility({ cgpa: 8, branch: 'B.Tech CSE', graduationYear: 2026 }, { minCgpa: null, eligibleBranches: ['Computer Science', 'Information Technology'], graduationYears: [], deadline: null });
        expect(e.eligible).toBe(true);
        const no = checkEligibility({ cgpa: 8, branch: 'Mechanical', graduationYear: 2026 }, { minCgpa: null, eligibleBranches: ['Computer Science'], graduationYears: [], deadline: null });
        expect(no.eligible).toBe(false);
    });

    test('graduation year and deadline', () => {
        const now = new Date('2026-10-01');
        expect(checkEligibility({ cgpa: 8, branch: null, graduationYear: 2027 }, { minCgpa: null, eligibleBranches: [], graduationYears: [2025, 2026], deadline: null }, now).flags[0]).toContain('2027');
        expect(checkEligibility({ cgpa: 8, branch: null, graduationYear: 2026 }, { minCgpa: null, eligibleBranches: [], graduationYears: [], deadline: new Date('2026-09-01') }, now).flags[0]).toContain('deadline');
    });

    test('missing profile data is "unknown", not a failure', () => {
        const e = checkEligibility({ cgpa: null, branch: null, graduationYear: null }, { minCgpa: 7, eligibleBranches: ['Computer Science'], graduationYears: [2026], deadline: null });
        expect(e.eligible).toBe(true);
        expect(e.unknown).toHaveLength(3);
    });
});
