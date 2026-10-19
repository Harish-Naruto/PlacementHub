import { describe, expect, test } from 'bun:test';
import { canonicalSkill, findSkillMentions } from '../src/skills/canonical';
import { TAXONOMY } from '../src/skills/taxonomy';

describe('skill taxonomy', () => {
    test('React variants all resolve to one skill', () => {
        for (const v of ['React', 'ReactJS', 'React.js', 'react js', 'REACT.JS']) expect(canonicalSkill(v)).toBe('React');
    });

    test('Java and JavaScript stay distinct; C++ and C# keep their symbols', () => {
        expect(canonicalSkill('Java')).toBe('Java');
        expect(canonicalSkill('JavaScript')).toBe('JavaScript');
        expect(canonicalSkill('JS')).toBe('JavaScript');
        expect(canonicalSkill('c++')).toBe('C++');
        expect(canonicalSkill('C#')).toBe('C#');
        expect(canonicalSkill('.NET')).toBe('.NET');
        expect(canonicalSkill('Node')).toBe('Node.js');
        expect(canonicalSkill('Postgres')).toBe('PostgreSQL');
    });

    test('unknown skills return null', () => {
        expect(canonicalSkill('Underwater Basket Weaving')).toBeNull();
    });

    test('no two skills share a variant', () => {
        const seen = new Map<string, string>();
        for (const s of TAXONOMY) {
            for (const v of [s.name, ...(s.aliases ?? []), ...(s.lookupOnly ?? [])]) {
                const key = v.toLowerCase().replace(/&/g, 'and').replace(/[\s._\-/]+/g, '');
                const owner = seen.get(key);
                expect(owner === undefined || owner === s.name).toBe(true);
                seen.set(key, s.name);
            }
        }
    });

    test('free text: finds skills, longest name wins, ignores ambiguous words', () => {
        const found = findSkillMentions('We use ReactJS and React Native, plus Node.js, PostgreSQL. Go to market fast. Chart.js is a plus. MySQL, not Oracle').map((m) => m.skill);
        expect(found).toContain('React');
        expect(found).toContain('React Native');
        expect(found).toContain('Node.js');
        expect(found).toContain('PostgreSQL');
        expect(found).toContain('MySQL');
        expect(found).not.toContain('Go');
        expect(found).not.toContain('Oracle');
        expect(found).not.toContain('JavaScript'); // "Chart.js" is not JavaScript
    });

    test('Java is not found inside JavaScript', () => {
        const found = findSkillMentions('Strong JavaScript skills').map((m) => m.skill);
        expect(found).toEqual(['JavaScript']);
    });
});
