// Branch names arrive in many spellings ("CSE", "Computer Science & Engineering", "B.Tech CSE").
// Both job eligibility and student profiles are reduced to one key before comparing.

const BRANCHES: { key: string; label: string; patterns: RegExp[] }[] = [
    { key: 'cse', label: 'Computer Science', patterns: [/\bcse\b/i, /computer\s*science/i, /\bcs\b/i, /\bcomputer\s*engineering\b/i] },
    { key: 'it', label: 'Information Technology', patterns: [/\binformation\s*technology\b/i, /\bIT\b/] },
    { key: 'aiml', label: 'AI & Machine Learning', patterns: [/\bai\s*(&|and|\/)?\s*ml\b/i, /\baiml\b/i, /artificial\s*intelligence/i, /machine\s*learning\s*(engineering|branch)/i, /data\s*science/i] },
    { key: 'ece', label: 'Electronics & Communication', patterns: [/\bece\b/i, /electronics\s*(&|and)?\s*communication/i, /\bentc\b/i, /\bextc\b/i] },
    { key: 'eee', label: 'Electrical', patterns: [/\beee\b/i, /\belectrical\b/i] },
    { key: 'mech', label: 'Mechanical', patterns: [/\bmech(anical)?\b/i] },
    { key: 'civil', label: 'Civil', patterns: [/\bcivil\b/i] },
    { key: 'chem', label: 'Chemical', patterns: [/\bchem(ical)?\b/i] },
];

/** Reduces a branch name to a stable key, or null when it is not recognised. */
export function branchKey(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const text = raw.trim();
    if (!text) return null;
    // "Information Technology" must win over the standalone "IT" and "Computer Science" over "CS".
    const order = ['aiml', 'it', 'ece', 'eee', 'mech', 'civil', 'chem', 'cse'];
    for (const key of order) {
        const b = BRANCHES.find((x) => x.key === key)!;
        if (b.patterns.some((p) => p.test(text))) return b.key;
    }
    return null;
}

export const branchLabel = (key: string): string => BRANCHES.find((b) => b.key === key)?.label ?? key;

/** Branch labels mentioned in a piece of text, in order, de-duplicated. */
export function findBranches(text: string): string[] {
    const found = new Set<string>();
    for (const b of BRANCHES) {
        // Search the text per branch so one line can name several ("CSE, IT, ECE").
        if (b.patterns.some((p) => new RegExp(p.source, p.flags.replace('g', '')).test(text))) found.add(b.label);
    }
    return [...found];
}
