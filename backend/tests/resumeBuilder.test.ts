import { describe, expect, test } from 'bun:test';
import { buildResume, countLines, hasUnverifiableMetric, MAX_LINES, renderResumeHtml, type BuilderInput, type BuilderSkill } from '../src/resumeBuilder/build';
import { checkResumeClaims, parseMonth } from '../src/resumeBuilder/claimCheck';
import type { ParsedResume } from '../src/resume/schema';

const sk = (skill: string, status: BuilderSkill['status'], assessment: number | null, urls: string[] = []): BuilderSkill => ({
    skill,
    status,
    assessmentScore: assessment,
    githubScore: urls.length ? 100 : null,
    combinedScore: assessment === null ? null : assessment,
    evidenceUrls: urls,
});

const base = (over: Partial<BuilderInput> = {}): BuilderInput => ({
    profile: { name: 'Asha Rao', email: 'asha@example.com', githubUsername: 'asha', linkedinUrl: null, institution: 'COEP', degree: 'B.Tech', branch: 'Computer Science', graduationYear: 2026, cgpa: 8.4 },
    skills: [
        sk('React', 'EVALUATED', 88, ['https://github.com/asha/shop/blob/abc/package.json']),
        sk('Node.js', 'EVALUATED', 75),
        sk('Docker', 'SELF_DECLARED', null),
        sk('Redis', 'NEEDS_REVIEW', 30),
    ],
    projects: [
        {
            id: 'p1',
            title: 'ShopFront',
            description: null,
            role: null,
            technologies: ['React', 'Node.js', 'Docker'],
            features: ['Implemented product search with filters', 'Cached sessions in Redis', 'Improved load time by 40%'],
            repositoryUrl: 'https://github.com/asha/shop',
        },
    ],
    experience: [{ organization: 'Acme', title: 'Intern', startDate: 'Jun 2025', endDate: 'Aug 2025', isCurrent: false, responsibilities: ['Built dashboard widgets in React', 'Deployed services with Docker'] }],
    job: { title: 'Frontend Engineer', company: 'Globex', requirements: [{ skill: 'React', type: 'REQUIRED' }, { skill: 'Docker', type: 'PREFERRED' }] },
    ...over,
});

describe('resume builder', () => {
    const r = buildResume(base());
    const allText = JSON.stringify({ ...r, blocked: undefined, ledger: undefined });

    test('skills section contains only verified skills', () => {
        expect(r.skills.map((s) => s.skill)).toEqual(['React', 'Node.js']);
        expect(allText).not.toContain('Docker');
        expect(allText).not.toContain('Redis');
    });

    test('unsupported skills are blocked with a reason and an action', () => {
        const docker = r.blocked.find((b) => b.claim === 'Docker' && b.kind === 'skill')!;
        expect(docker.reason).toContain('not backed by any evidence');
        expect(docker.action).toContain('Docker');
        const redis = r.blocked.find((b) => b.claim === 'Redis' && b.kind === 'skill')!;
        expect(redis.reason).toContain('30%');
    });

    test('project lists only verified technologies; the unverified one is blocked', () => {
        const built = r.projects[0]!.bullets[0]!;
        expect(built.text).toBe('Built ShopFront using React, Node.js.');
        expect(r.blocked.some((b) => b.kind === 'project_technology' && b.claim.startsWith('Docker'))).toBe(true);
    });

    test('feature naming an unverified skill, or a metric, is blocked', () => {
        const texts = r.projects[0]!.bullets.map((b) => b.text).join(' ');
        expect(texts).toContain('product search');
        expect(texts).not.toContain('Redis');
        expect(texts).not.toContain('40%');
        expect(r.blocked.some((b) => b.kind === 'feature' && b.claim.includes('Redis'))).toBe(true);
        expect(r.blocked.some((b) => b.kind === 'metric')).toBe(true);
    });

    test('every bullet has fact ids and proof, and every fact id exists in the ledger', () => {
        const ids = new Set(r.ledger.map((l) => l.factId));
        const bullets = [...r.projects.flatMap((p) => p.bullets), ...r.experience.flatMap((x) => x.bullets), ...(r.summary ? [r.summary] : []), ...(r.education ? [r.education] : [])];
        expect(bullets.length).toBeGreaterThan(3);
        for (const b of bullets) {
            expect(b.factIds.length).toBeGreaterThan(0);
            expect(b.proof.length).toBeGreaterThan(0);
            for (const id of b.factIds) expect(ids.has(id)).toBe(true);
        }
    });

    test('experience responsibility naming an unverified skill is blocked', () => {
        const bullets = r.experience[0]!.bullets.map((b) => b.text).join(' ');
        expect(bullets).toContain('dashboard widgets in React');
        expect(bullets).not.toContain('Docker');
        expect(r.blocked.some((b) => b.kind === 'responsibility' && b.claim.includes('Docker'))).toBe(true);
    });

    test('verified skills are ordered by job relevance first', () => {
        const out = buildResume(base({ job: { title: 'Backend', company: null, requirements: [{ skill: 'Node.js', type: 'REQUIRED' }] } }));
        expect(out.skills[0]!.skill).toBe('Node.js');
    });

    test('a project with no verified technology is blocked entirely', () => {
        const out = buildResume(base({ projects: [{ id: 'x', title: 'Ghost', description: 'Something', role: null, technologies: ['Docker'], features: ['Did a thing'], repositoryUrl: null }] }));
        expect(out.projects).toEqual([]);
        expect(out.blocked.some((b) => b.kind === 'project' && b.claim.includes('Ghost'))).toBe(true);
    });

    test('fits the one-page budget by dropping the least relevant content, and says what it dropped', () => {
        const many = Array.from({ length: 30 }, (_, i) => `Implemented feature number ${i} for the platform using React with a long descriptive sentence to take space`);
        const out = buildResume(
            base({
                projects: Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, title: `Project ${i}`, description: null, role: null, technologies: ['React'], features: many, repositoryUrl: null })),
                experience: [{ organization: 'A', title: 'T', startDate: '2024', endDate: '2025', isCurrent: false, responsibilities: many }],
            }),
        );
        expect(countLines(out)).toBeLessThanOrEqual(MAX_LINES);
        expect(out.stats.lines).toBeLessThanOrEqual(MAX_LINES);
        expect(out.ledger.some((l) => l.status === 'dropped_for_space')).toBe(true);
    });

    test('deterministic: same input, same output', () => {
        expect(JSON.stringify(buildResume(base()))).toBe(JSON.stringify(buildResume(base())));
    });

    test('HTML is escaped, single column, with fact ids', () => {
        const html = renderResumeHtml(buildResume(base({ profile: { ...base().profile, name: 'A <b>sha</b>' } })));
        expect(html).toContain('A &lt;b&gt;sha&lt;/b&gt;');
        expect(html).toContain('data-facts=');
        expect(html).not.toContain('<table');
        expect(html).not.toContain('<img');
    });

    test('metric detector', () => {
        expect(hasUnverifiableMetric('Improved load time by 40%')).toBe(true);
        expect(hasUnverifiableMetric('Served 10k users')).toBe(true);
        expect(hasUnverifiableMetric('Reduced latency from slow to fast 3 times')).toBe(true);
        expect(hasUnverifiableMetric('Led a team of 10')).toBe(true);
        expect(hasUnverifiableMetric('Built a REST API with Express')).toBe(false);
        expect(hasUnverifiableMetric('Used Python 3 for scripting')).toBe(false);
    });
});

describe('claim check for an uploaded resume', () => {
    const resume: ParsedResume = {
        schema_version: '1.0',
        skills: [
            { name: 'ReactJS', canonical_name: 'React', category: null, claim_type: 'listed_skill', evidence: [] },
            { name: 'Docker', canonical_name: 'Docker', category: null, claim_type: 'listed_skill', evidence: [] },
            { name: 'Redis', canonical_name: 'Redis', category: null, claim_type: 'listed_skill', evidence: [] },
            { name: 'Go', canonical_name: 'Go', category: null, claim_type: 'listed_skill', evidence: [] },
            { name: 'Python', canonical_name: 'Python', category: null, claim_type: 'listed_skill', evidence: [] },
        ],
        projects: [{ name: 'Shop', description: null, role: null, technologies: ['React', 'Redis'], features: [{ claim: 'Built search', evidence_text: '' }, { claim: 'Cut costs by 60%', evidence_text: '' }, { claim: 'Used Docker for deploys', evidence_text: '' }], repository_urls: [], evidence: [] }],
        experience: [{ organization: 'Acme', title: 'Dev', start_date: 'Jan 2030', end_date: 'Jan 2020', is_current: false, responsibilities: [], technologies: [], evidence: [] }],
        links: { github_profiles: [], github_repositories: [], portfolios: [] },
    };
    const skills: BuilderSkill[] = [
        sk('React', 'EVALUATED', 90, ['https://github.com/a/b/blob/x/package.json']),
        sk('Redis', 'NEEDS_REVIEW', 20),
        sk('Go', 'NEEDS_REVIEW', 70, ['https://github.com/a/b/blob/x/go.mod']),
        { ...sk('Python', 'REPOSITORY_OBSERVED', null, ['https://github.com/a/b/blob/x/app.py']), combinedScore: null },
    ];
    const result = checkResumeClaims(resume, skills, new Date('2026-10-17'));
    const verdict = (kind: string, claim: string) => result.entries.find((e) => e.kind === kind && e.claim.startsWith(claim))?.verdict;

    test('skill verdicts follow the stored evidence, aliases merged', () => {
        expect(verdict('skill', 'React')).toBe('supported');
        expect(verdict('skill', 'Python')).toBe('partially_supported');
        expect(verdict('skill', 'Docker')).toBe('unverified');
        expect(verdict('skill', 'Redis')).toBe('unsupported'); // assessed 20%, no GitHub
        expect(verdict('skill', 'Go')).toBe('needs_review'); // assessment 70 stored as needs_review with GitHub: sources disagree
        expect(result.entries.filter((e) => e.kind === 'skill' && e.claim === 'React')).toHaveLength(1);
    });

    test('project features: unverified skill or metric is flagged; plain feature is self-reported', () => {
        expect(verdict('project_feature', 'Built search')).toBe('self_reported');
        expect(verdict('project_feature', 'Cut costs')).toBe('unverified');
        expect(verdict('project_feature', 'Used Docker')).toBe('unsupported');
    });

    test('impossible dates are flagged', () => {
        expect(result.entries.find((e) => e.kind === 'experience_dates')).toMatchObject({ verdict: 'needs_review', flagged: true });
    });

    test('summary counts match the entries', () => {
        const total = Object.values(result.summary).slice(0, 6).reduce((a, b) => a + b, 0);
        expect(total).toBe(result.summary.total);
        expect(result.summary.flagged).toBe(result.entries.filter((e) => e.flagged).length);
        expect(result.summary.flagged).toBeGreaterThan(0);
    });

    test('date parsing', () => {
        expect(parseMonth('Jun 2023')).toBe(2023 * 12 + 5);
        expect(parseMonth('06/2023')).toBe(2023 * 12 + 5);
        expect(parseMonth('2023')).toBe(2023 * 12);
        expect(parseMonth('Present')).toBeNull();
        expect(parseMonth('garbage')).toBeNull();
    });
});
