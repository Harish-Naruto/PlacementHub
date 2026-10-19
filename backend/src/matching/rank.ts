// Ordering of candidates by evidence-backed fit. Pure.
//
// Eligible candidates come before ineligible ones, then: fit (a null fit last), required skills demonstrated,
// CGPA, name. The same order is used for the placement batch ranking and a recruiter's applicant shortlist.

import type { FitResult } from './fit.ts';

export interface RankableCandidate {
    name: string;
    cgpa: number | null;
    fit: FitResult;
}

export function compareCandidates(a: RankableCandidate, b: RankableCandidate): number {
    const eligible = Number(b.fit.eligibility.eligible) - Number(a.fit.eligibility.eligible);
    if (eligible) return eligible;
    const fit = (b.fit.fitScore ?? -1) - (a.fit.fitScore ?? -1);
    if (fit) return fit;
    const required = b.fit.requiredDemonstrated - a.fit.requiredDemonstrated;
    if (required) return required;
    const cgpa = (b.cgpa ?? -1) - (a.cgpa ?? -1);
    if (cgpa) return cgpa;
    return a.name.localeCompare(b.name);
}

export function rankCandidates<T extends RankableCandidate>(rows: T[], opts: { includeIneligible?: boolean; limit?: number } = {}): (T & { rank: number })[] {
    const kept = opts.includeIneligible === false ? rows.filter((r) => r.fit.eligibility.eligible) : rows;
    const sorted = [...kept].sort(compareCandidates);
    return (opts.limit ? sorted.slice(0, opts.limit) : sorted).map((r, i) => ({ ...r, rank: i + 1 }));
}
