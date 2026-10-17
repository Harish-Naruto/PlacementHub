import { describe, expect, test } from 'bun:test';
import { parseJob, parseJobRules } from '../src/jobs/parseJob';
import { dedupeKey, findDuplicate, mergeRequirements, normalizeCity, normalizeCompany, similarity, titleTokens, type ExistingJob } from '../src/jobs/dedupe';

const WHATSAPP = `*Hiring: ReactJS Developer at Acme Pvt Ltd*
Location: Pune (Hybrid)
Batch: 2025 & 2026 freshers
Eligibility: CSE, IT, ECE branches, minimum 7.5 CGPA

Requirements:
- Strong React.js and JavaScript
- Node and Postgres basics
- Good understanding of REST APIs

Nice to have: Docker, AWS
Apply by 30 Nov 2026

Benefits: free lunch, Kubernetes training`;

describe('job parser (rules)', () => {
    const job = parseJobRules(WHATSAPP);

    test('required and preferred skills are separated and normalised', () => {
        expect(job.required).toEqual(expect.arrayContaining(['React', 'JavaScript', 'PostgreSQL', 'REST API']));
        expect(job.preferred).toEqual(expect.arrayContaining(['Docker', 'AWS']));
        expect(job.required).not.toContain('Docker');
    });

    test('skills in a benefits section are ignored', () => {
        expect([...job.required, ...job.preferred]).not.toContain('Kubernetes');
    });

    test('eligibility fields', () => {
        expect(job.minCgpa).toBe(7.5);
        expect(job.graduationYears).toEqual([2025, 2026]);
        expect(job.eligibleBranches).toEqual(expect.arrayContaining(['Computer Science', 'Information Technology', 'Electronics & Communication']));
        expect(job.workMode).toBe('HYBRID');
        expect(job.location).toBe('Pune (Hybrid)');
        expect(job.deadline?.startsWith('2026-11-')).toBe(true);
    });

    test('title and company', () => {
        expect(job.title).toBe('ReactJS Developer');
        expect(job.company).toBe('Acme Pvt Ltd');
        expect(job.parseMethod).toBe('rules');
    });

    test('inline "is a plus" marks a skill as preferred', () => {
        const j = parseJobRules('Backend Engineer\nRequirements:\nPython and Django\nExperience with Redis is a plus');
        expect(j.required).toEqual(expect.arrayContaining(['Python', 'Django']));
        expect(j.preferred).toEqual(['Redis']);
    });

    test('a single-line posting with inline headings and ambiguous skill names in a list', () => {
        const j = parseJobRules('Backend developer. Requirements: Node.js, Express, PostgreSQL. Nice to have: Docker, Go. Minimum CGPA 7');
        expect(j.required).toEqual(expect.arrayContaining(['Node.js', 'Express.js', 'PostgreSQL']));
        expect(j.preferred).toEqual(expect.arrayContaining(['Docker', 'Go']));
        expect(j.required).not.toContain('Docker');
        expect(j.minCgpa).toBe(7);
    });

    test('prose is not read as a skill list ("go" and "express" in a sentence stay ignored)', () => {
        const j = parseJobRules('Software Engineer\nWe go to market fast, and we express ideas clearly.\nRequirements: React');
        expect(j.required).toEqual(['React']);
    });

    test('a role named inside a sentence: "X is hiring a ... in ..."', () => {
        const j = parseJobRules('Referral from alumni: Acme is hiring a ReactJS Developer in Pune (hybrid).\nCompany: Acme Technologies\nRequirements:\nReact, JavaScript');
        expect(j.title).toBe('ReactJS Developer');
        expect(j.company).toBe('Acme Technologies');
    });

    test('internship detection and a skill in both lists stays required', () => {
        const j = parseJobRules('Software Engineering Intern\nRequirements: React\nNice to have: React, Git');
        expect(j.employmentType).toBe('INTERNSHIP');
        expect(j.required).toContain('React');
        expect(j.preferred).toEqual(['Git']);
    });
});

describe('job parser (LLM path)', () => {
    test('uses the LLM result and canonicalises its skills', async () => {
        const generate = async () => JSON.stringify({ title: 'Frontend Dev', company: 'Foo', required: ['ReactJS', 'react.js', 'TypeScript'], preferred: ['Tailwind'], location: 'Remote', employmentType: 'FULL_TIME' });
        const j = await parseJob('whatever', { generate });
        expect(j.parseMethod).toBe('llm');
        expect(j.required).toEqual(['React', 'TypeScript']);
        expect(j.preferred).toEqual(['Tailwind CSS']);
    });

    test('falls back to rules on bad JSON, and when the LLM finds no skills', async () => {
        const bad = await parseJob('Backend Engineer\nRequirements: Python', { generate: async () => 'not json' });
        expect(bad.parseMethod).toBe('rules');
        expect(bad.required).toContain('Python');
        const empty = await parseJob('Backend Engineer\nRequirements: Python', { generate: async () => JSON.stringify({ title: 'x', required: [], preferred: [] }) });
        expect(empty.parseMethod).toBe('rules');
    });

    test('a thrown error also falls back', async () => {
        const j = await parseJob('Dev\nRequirements: Golang, Java', {
            generate: async () => {
                throw new Error('quota');
            },
        });
        expect(j.parseMethod).toBe('rules');
    });
});

describe('normalisation for dedupe', () => {
    test('company noise words', () => {
        expect(normalizeCompany('Acme Pvt. Ltd.')).toBe('acme');
        expect(normalizeCompany('ACME Technologies Private Limited')).toBe('acme');
    });

    test('title tokens: skill aliases, developer = engineer, noise removed', () => {
        expect(titleTokens('ReactJS Developer')).toEqual(titleTokens('React.js developer - (0-2 years) Hiring Freshers'));
        expect(titleTokens('SDE')).toEqual(titleTokens('Software Engineer'));
    });

    test('cities', () => {
        expect(normalizeCity('Bengaluru, Karnataka')).toBe('bangalore');
        expect(normalizeCity('Pune (Hybrid)')).toBe('pune');
        expect(normalizeCity('Remote - India')).toBe('remote');
        expect(normalizeCity(null)).toBe('');
    });
});

describe('dedupe', () => {
    const base = { company: 'Acme Pvt Ltd', title: 'ReactJS Developer', location: 'Pune', skills: ['React', 'JavaScript', 'Node.js'] };
    const existing: ExistingJob[] = [{ id: 'job-1', dedupeKey: dedupeKey(base), ...base }];

    test('same opening worded differently has the same key', () => {
        expect(dedupeKey({ company: 'ACME', title: 'React.js developer', location: 'Pune, Maharashtra' })).toBe(dedupeKey(base));
    });

    test('exact duplicate is found', () => {
        const d = findDuplicate({ company: 'ACME', title: 'React.js developer', location: 'Pune', skills: [] }, existing);
        expect(d).toMatchObject({ kind: 'exact', jobId: 'job-1' });
    });

    test('fuzzy duplicate: missing location, near-identical title and skills', () => {
        const d = findDuplicate({ company: 'Acme', title: 'ReactJS Developer', location: null, skills: ['React', 'JavaScript', 'Node.js', 'Git'] }, existing);
        expect(d.kind === 'fuzzy' || d.kind === 'exact').toBe(true);
    });

    test('a shorter posting naming a subset of the skills is the same opening', () => {
        const d = findDuplicate({ company: 'Acme Technologies', title: 'ReactJS Developer', location: null, skills: ['React', 'JavaScript', 'TypeScript'] }, existing);
        expect(d.kind).toBe('fuzzy');
    });

    test('the same role in a different city is a separate opening; a remote listing is compatible', () => {
        const same = { company: 'Acme', title: 'ReactJS Developer', skills: ['React', 'JavaScript', 'Node.js'] };
        expect(findDuplicate({ ...same, location: 'Mumbai' }, existing).kind).toBe('none');
        expect(findDuplicate({ ...same, location: 'Remote - India' }, existing).kind).toBe('fuzzy');
    });

    test('same title and company but unrelated skills is a different opening', () => {
        const d = findDuplicate({ company: 'Acme', title: 'ReactJS Developer', location: 'Mumbai', skills: ['Excel', 'Tableau', 'SQL'] }, existing);
        expect(d.kind).toBe('none');
    });

    test('different role at the same company is not merged', () => {
        const d = findDuplicate({ company: 'Acme', title: 'Data Analyst', location: 'Pune', skills: ['SQL', 'Excel'] }, existing);
        expect(d.kind).toBe('none');
    });

    test('same title at a different company is not merged', () => {
        const d = findDuplicate({ company: 'Globex', title: 'ReactJS Developer', location: 'Pune', skills: ['React'] }, existing);
        expect(d.kind).toBe('none');
    });

    test('similarity uses the title alone when a side has no skills', () => {
        expect(similarity({ company: 'a', title: 'React Developer', location: null, skills: [] }, { company: 'a', title: 'React Engineer', location: null, skills: ['React'] })).toBe(100);
    });

    test('merging requirements: required beats preferred, first order kept', () => {
        const merged = mergeRequirements(
            [
                { skill: 'React', type: 'PREFERRED' },
                { skill: 'Docker', type: 'PREFERRED' },
            ],
            [
                { skill: 'react', type: 'REQUIRED' },
                { skill: 'AWS', type: 'REQUIRED' },
            ],
        );
        expect(merged).toEqual([
            { skill: 'React', type: 'REQUIRED' },
            { skill: 'Docker', type: 'PREFERRED' },
            { skill: 'AWS', type: 'REQUIRED' },
        ]);
    });
});
