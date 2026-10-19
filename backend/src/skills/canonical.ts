import { TAXONOMY, type TaxonomySkill } from './taxonomy.ts';

// Whole-name lookup ("ReactJS" -> "React") and scanning of free text for skill mentions.

/** Lookup key: lower case, "&" as "and", separators removed. "C++", "C#" and "ASP.NET" stay distinct. */
export const lookupKey = (name: string): string =>
    name
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[\s._\-/]+/g, '');

const BY_KEY = new Map<string, TaxonomySkill>();
for (const skill of TAXONOMY) {
    for (const variant of [skill.name, ...(skill.aliases ?? []), ...(skill.lookupOnly ?? [])]) {
        const key = lookupKey(variant);
        if (key && !BY_KEY.has(key)) BY_KEY.set(key, skill);
    }
}

export interface SkillInfo {
    name: string;
    category: string;
}

/** The taxonomy entry for a skill name or alias, or null when the skill is unknown. */
export function skillInfo(name: string): SkillInfo | null {
    const hit = BY_KEY.get(lookupKey(name.trim()));
    return hit ? { name: hit.name, category: hit.category } : null;
}

/** Canonical name for a skill name or alias, or null when the skill is unknown. */
export const canonicalSkill = (name: string): string | null => skillInfo(name)?.name ?? null;

/** Canonical name when known, otherwise the trimmed input. */
export const canonicalOrSelf = (name: string): string => canonicalSkill(name) ?? name.trim();

// Skill names too ambiguous to find in a sentence ("Go", "Excel", "Oracle"); they still resolve as a whole name.
const UNSCANNED_NAMES = new Set(['Go', 'R', 'C', 'Excel', 'Oracle', 'Testing', 'Swift', 'Shell']);

interface ScanTerm {
    term: string;
    skill: string;
    pattern: RegExp;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SCAN_TERMS: ScanTerm[] = TAXONOMY.flatMap((skill) => {
    const terms = [...(UNSCANNED_NAMES.has(skill.name) ? [] : [skill.name]), ...(skill.aliases ?? [])];
    return terms.map((term) => ({
        term,
        skill: skill.name,
        // Not inside a longer word, and not a suffix of a dotted name like "chart.js".
        pattern: new RegExp(`(?<![A-Za-z0-9+#.])${escapeRegex(term)}(?![A-Za-z0-9+#])`, 'ig'),
    }));
}).sort((a, b) => b.term.length - a.term.length);

export interface SkillMention {
    skill: string;
    /** Character offset of the first mention. */
    index: number;
}

/** Skills mentioned in free text, in order of first appearance. Longer names win ("React Native" over "React"). */
export function findSkillMentions(text: string): SkillMention[] {
    let work = text;
    const first = new Map<string, number>();
    for (const t of SCAN_TERMS) {
        t.pattern.lastIndex = 0;
        for (let m = t.pattern.exec(work); m; m = t.pattern.exec(work)) {
            const prev = first.get(t.skill);
            if (prev === undefined || m.index < prev) first.set(t.skill, m.index);
            // Blank the match so a shorter term cannot match inside it.
            work = work.slice(0, m.index) + ' '.repeat(m[0].length) + work.slice(m.index + m[0].length);
        }
    }
    return [...first.entries()].map(([skill, index]) => ({ skill, index })).sort((a, b) => a.index - b.index);
}

export const ALL_SKILLS: readonly TaxonomySkill[] = TAXONOMY;
