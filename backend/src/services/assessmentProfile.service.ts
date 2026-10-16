/**
 * Builds the compact, de-duplicated candidate profile the assessment is based on.
 *
 * Source of truth is the ParsedResume row written by the resume parser
 * (see resumeparser.output.json for the shape).
 */

import prisma from '../config/prisma';
import type { ParsedResume } from '../resume/schema';
import { ApiError } from '../utils/apiError';

export interface AssessmentProfile {
    /** Skills worth verifying, strongest evidence first. Tooling (Git, VS Code…) is excluded. */
    skills: string[];
    projects: { name: string; technologies: string[]; highlights: string[] }[];
    experience: { title: string; organization: string; technologies: string[]; highlights: string[] }[];
}

const MAX_SKILLS = 10;
const MAX_PROJECTS = 4;
const MAX_HIGHLIGHTS = 3;
const MAX_TEXT = 220;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOOLING_CATEGORY = /tool/i;

const clip = (s: string) => (s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT)}…` : s);

export function profileFromParsedResume(resume: ParsedResume): AssessmentProfile {
    // The parser emits one row per mention (listed + once per project), so merge by canonical name.
    const skills = new Map<string, { name: string; listed: boolean; mentions: number; tooling: boolean }>();
    for (const s of resume.skills) {
        const name = s.canonical_name ?? s.name;
        const entry = skills.get(name.toLowerCase()) ?? { name, listed: false, mentions: 0, tooling: false };
        entry.mentions += 1;
        if (s.claim_type === 'listed_skill') entry.listed = true;
        if (s.category && TOOLING_CATEGORY.test(s.category)) entry.tooling = true;
        skills.set(name.toLowerCase(), entry);
    }

    const ranked = [...skills.values()]
        .filter((s) => !s.tooling)
        // Used in projects/jobs AND listed is the strongest claim; then by how often it appears.
        .sort((a, b) => b.mentions - a.mentions || Number(b.listed) - Number(a.listed))
        .slice(0, MAX_SKILLS)
        .map((s) => s.name);

    return {
        skills: ranked,
        projects: resume.projects.slice(0, MAX_PROJECTS).map((p) => ({
            name: p.name,
            technologies: p.technologies,
            highlights: [
                ...(p.description ? [p.description] : []),
                ...p.features.map((f) => f.claim),
            ]
                .slice(0, MAX_HIGHLIGHTS)
                .map(clip),
        })),
        experience: resume.experience.map((e) => ({
            title: e.title ?? 'Role',
            organization: e.organization ?? 'Unknown',
            technologies: e.technologies,
            highlights: e.responsibilities.slice(0, MAX_HIGHLIGHTS).map(clip),
        })),
    };
}

/** Loads the profile for `resumeId`, enforcing that the parsed resume belongs to `userId`. */
export async function loadProfile(resumeId: string, userId: string): Promise<AssessmentProfile> {
    const row = UUID.test(resumeId) ? await prisma.parsedResume.findUnique({ where: { id: resumeId } }) : null;
    // Same response for "missing" and "someone else's" so ids cannot be probed.
    if (!row || row.userId !== userId) throw new ApiError('Resume not found', 404, true, 'NOT_FOUND');

    const profile = profileFromParsedResume(row.data as unknown as ParsedResume);
    if (profile.skills.length === 0 && profile.projects.length === 0) {
        throw new ApiError('This resume has no skills or projects to assess', 422, true, 'EMPTY_RESUME');
    }
    return profile;
}
