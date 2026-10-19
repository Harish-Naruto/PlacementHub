// Builds a tailored, one-page resume for one opening where every line traces to evidence.
// Pure: no database, network or LLM. Bullets are templates over facts, so nothing can be invented.
//
// Tiers
//   verified       backed by stored evidence (assessment and/or GitHub): skills, and project technologies
//   self_reported  facts only the student can attest (education, project descriptions, responsibilities).
//                  Included, labelled, and still checked: a line that names an unverified skill or states
//                  a number that cannot be verified is blocked, not trimmed.
//   blocked        never appears on the resume; listed with the reason and what would fix it

import { canonicalOrSelf, findSkillMentions } from '../skills/canonical.ts';

export const MAX_LINES = 48;
export const MAX_SKILLS = 16;
export const MAX_PROJECTS = 3;
export const MAX_BULLETS_PER_PROJECT = 3;
export const MAX_EXPERIENCE = 2;
export const MAX_BULLETS_PER_ROLE = 3;
const CHARS_PER_LINE = 98;
const MAX_BULLET_CHARS = 180;

export type SkillStatus = 'SELF_DECLARED' | 'REPOSITORY_OBSERVED' | 'EVALUATED' | 'NEEDS_REVIEW';

export interface BuilderSkill {
    skill: string;
    status: SkillStatus;
    combinedScore: number | null;
    assessmentScore: number | null;
    githubScore: number | null;
    /** Commit-pinned GitHub evidence links. */
    evidenceUrls: string[];
}

export interface BuilderProject {
    id: string;
    title: string;
    description: string | null;
    role: string | null;
    technologies: string[];
    features: string[];
    repositoryUrl: string | null;
}

export interface BuilderExperience {
    organization: string | null;
    title: string | null;
    startDate: string | null;
    endDate: string | null;
    isCurrent: boolean | null;
    responsibilities: string[];
}

export interface BuilderProfile {
    name: string;
    email: string | null;
    githubUsername: string | null;
    linkedinUrl: string | null;
    institution: string | null;
    degree: string | null;
    branch: string | null;
    graduationYear: number | null;
    cgpa: number | null;
}

export interface BuilderJob {
    title: string;
    company: string | null;
    requirements: { skill: string; type: 'REQUIRED' | 'PREFERRED'; weight?: number }[];
}

export interface BuilderInput {
    profile: BuilderProfile;
    skills: BuilderSkill[];
    projects: BuilderProject[];
    experience: BuilderExperience[];
    job: BuilderJob;
}

export interface ProofRef {
    kind: 'assessment' | 'github' | 'resume' | 'profile';
    label: string;
    url?: string;
}

export type Tier = 'verified' | 'self_reported';

export interface ResumeBullet {
    text: string;
    tier: Tier;
    /** Ids of the facts this line comes from (see `ledger`). */
    factIds: string[];
    proof: ProofRef[];
    relevance: number;
}

export interface ResumeSkill {
    skill: string;
    factId: string;
    combinedScore: number | null;
    proof: ProofRef[];
}

export interface BlockedClaim {
    claim: string;
    kind: 'skill' | 'project' | 'project_technology' | 'feature' | 'responsibility' | 'metric';
    reason: string;
    /** What would make the claim usable. */
    action: string;
}

export interface LedgerEntry {
    factId: string;
    text: string;
    status: 'verified' | 'self_reported' | 'blocked' | 'dropped_for_space';
    reason: string;
}

export interface GeneratedResume {
    job: { title: string; company: string | null };
    header: { name: string; email: string | null; github: string | null; linkedin: string | null };
    summary: ResumeBullet | null;
    skills: ResumeSkill[];
    projects: { id: string; title: string; link: string | null; bullets: ResumeBullet[] }[];
    experience: { organization: string; title: string | null; dates: string | null; bullets: ResumeBullet[] }[];
    education: ResumeBullet | null;
    blocked: BlockedClaim[];
    ledger: LedgerEntry[];
    stats: { lines: number; maxLines: number; droppedForSpace: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const keyOf = (name: string) => canonicalOrSelf(name).toLowerCase();
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Numbers that state an outcome or scale. Nothing in the evidence can confirm them.
const METRIC =
    /\b\d+(?:[.,]\d+)?\s*(?:%|x\b|×|k\+?\b|m\+?\b|\+?\s*(?:users|customers|clients|requests|downloads|transactions|records|rows|ms|milliseconds|seconds|hours|lines|stars))|\b(?:increased|reduced|improved|boosted|decreased|cut|saved|grew)\b[^.]{0,60}\b\d|\bteam of \d+|\b(?:led|managed|mentored|supervised)\b[^.]{0,30}\b\d+\b/i;

export const hasUnverifiableMetric = (text: string): boolean => METRIC.test(text);

function sentence(text: string): string {
    let t = text.replace(/\s+/g, ' ').replace(/^[\s•\-–—*]+/, '').trim();
    if (t.length > MAX_BULLET_CHARS) {
        const cut = t.slice(0, MAX_BULLET_CHARS);
        const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
        t = (end > 60 ? cut.slice(0, end) : cut.slice(0, cut.lastIndexOf(' '))).replace(/[,;:]$/, '');
    }
    t = t.charAt(0).toUpperCase() + t.slice(1);
    return /[.!?]$/.test(t) ? t : `${t}.`;
}

const linesFor = (text: string) => Math.max(1, Math.ceil((text.length + 2) / CHARS_PER_LINE));

// ---------------------------------------------------------------------------
// Skill tiers
// ---------------------------------------------------------------------------

interface SkillVerdict {
    verified: boolean;
    reason: string;
    action: string;
}

function verdictFor(skill: BuilderSkill | undefined, name: string): SkillVerdict {
    if (!skill) return { verified: false, reason: 'not on the profile', action: `Add ${name} and take its assessment or link a project that uses it.` };
    if (skill.status === 'EVALUATED' || skill.status === 'REPOSITORY_OBSERVED') return { verified: true, reason: '', action: '' };
    if (skill.status === 'NEEDS_REVIEW') {
        return {
            verified: false,
            reason: skill.assessmentScore !== null && skill.assessmentScore < 60 ? `assessed at ${skill.assessmentScore}%, below the pass mark` : 'assessment and repository evidence disagree',
            action: `Retake the ${name} assessment or add a repository that clearly uses it.`,
        };
    }
    return { verified: false, reason: 'claimed but not backed by any evidence yet', action: `Take the ${name} assessment or link a GitHub project that uses ${name}.` };
}

function proofForSkill(skill: BuilderSkill): ProofRef[] {
    const proof: ProofRef[] = [];
    if (skill.assessmentScore !== null) proof.push({ kind: 'assessment', label: `${skill.skill} assessment: ${skill.assessmentScore}%` });
    for (const url of skill.evidenceUrls.slice(0, 3)) proof.push({ kind: 'github', label: `${skill.skill} in GitHub`, url });
    return proof;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildResume(input: BuilderInput): GeneratedResume {
    const { profile, job } = input;
    const blocked: BlockedClaim[] = [];
    const ledger: LedgerEntry[] = [];

    const skillMap = new Map<string, BuilderSkill>();
    for (const s of input.skills) {
        const k = keyOf(s.skill);
        const prev = skillMap.get(k);
        if (!prev || (s.combinedScore ?? -1) > (prev.combinedScore ?? -1)) skillMap.set(k, s);
    }

    // Job relevance weights by canonical skill.
    const wanted = new Map<string, number>();
    for (const r of job.requirements) {
        const w = (r.weight ?? 1) * (r.type === 'REQUIRED' ? 1 : 0.5);
        const k = keyOf(r.skill);
        wanted.set(k, Math.max(wanted.get(k) ?? 0, w));
    }
    const relevanceOf = (skills: string[]) => skills.reduce((sum, s) => sum + (wanted.get(keyOf(s)) ?? 0), 0);

    const verified = (name: string) => verdictFor(skillMap.get(keyOf(name)), name).verified;

    /** Checks a free-text claim. Returns the problem, or null when the line may be used. */
    const checkLine = (text: string): { reason: string; action: string; kind: BlockedClaim['kind'] } | null => {
        const unverified = findSkillMentions(text)
            .map((m) => m.skill)
            .filter((s) => !verified(s));
        if (unverified.length) {
            const v = verdictFor(skillMap.get(keyOf(unverified[0]!)), unverified[0]!);
            return { reason: `mentions ${unverified.join(', ')}, which ${unverified.length > 1 ? 'have' : 'has'} no supporting evidence (${v.reason})`, action: v.action, kind: 'feature' };
        }
        if (hasUnverifiableMetric(text)) {
            return { reason: 'states a number or result that cannot be verified from any evidence', action: 'Remove the figure, or describe what was built without a metric.', kind: 'metric' };
        }
        return null;
    };

    // ---- Skills section ----------------------------------------------------------------------
    const skillEntries: ResumeSkill[] = [];
    for (const s of skillMap.values()) {
        const v = verdictFor(s, s.skill);
        const factId = `skill:${slug(s.skill)}`;
        if (v.verified) {
            skillEntries.push({ skill: s.skill, factId, combinedScore: s.combinedScore, proof: proofForSkill(s) });
            ledger.push({ factId, text: s.skill, status: 'verified', reason: s.assessmentScore !== null ? `assessment ${s.assessmentScore}%${s.evidenceUrls.length ? ` and ${s.evidenceUrls.length} GitHub evidence link(s)` : ''}` : `${s.evidenceUrls.length} GitHub evidence link(s)` });
        } else {
            blocked.push({ claim: s.skill, kind: 'skill', reason: v.reason, action: v.action });
            ledger.push({ factId, text: s.skill, status: 'blocked', reason: v.reason });
        }
    }
    skillEntries.sort(
        (a, b) => (wanted.get(keyOf(b.skill)) ?? 0) - (wanted.get(keyOf(a.skill)) ?? 0) || (b.combinedScore ?? 0) - (a.combinedScore ?? 0) || a.skill.localeCompare(b.skill),
    );
    const skills = skillEntries.slice(0, MAX_SKILLS);
    for (const dropped of skillEntries.slice(MAX_SKILLS)) {
        const e = ledger.find((l) => l.factId === dropped.factId);
        if (e) {
            e.status = 'dropped_for_space';
            e.reason = 'verified, but left out to keep the resume to one page';
        }
    }

    // ---- Projects ----------------------------------------------------------------------------
    interface ProjectDraft {
        id: string;
        title: string;
        link: string | null;
        bullets: ResumeBullet[];
        relevance: number;
    }
    const drafts: ProjectDraft[] = [];

    for (const p of input.projects) {
        const pid = `project:${slug(p.id || p.title)}`;
        const techs = [...new Map(p.technologies.map((t) => [keyOf(t), canonicalOrSelf(t)])).values()];
        const goodTechs = techs.filter(verified);
        for (const t of techs.filter((x) => !verified(x))) {
            const v = verdictFor(skillMap.get(keyOf(t)), t);
            blocked.push({ claim: `${t} in project "${p.title}"`, kind: 'project_technology', reason: v.reason, action: v.action });
        }
        if (goodTechs.length === 0) {
            const reason = 'none of its technologies is backed by evidence';
            blocked.push({ claim: `Project "${p.title}"`, kind: 'project', reason, action: 'Verify at least one of its technologies (assessment or GitHub) to include the project.' });
            ledger.push({ factId: `${pid}:built`, text: p.title, status: 'blocked', reason });
            continue;
        }

        const proof: ProofRef[] = [];
        for (const t of goodTechs) {
            const s = skillMap.get(keyOf(t));
            if (s) proof.push(...proofForSkill(s).slice(0, 2));
        }
        const bullets: ResumeBullet[] = [];
        const builtText = `Built ${p.title} using ${goodTechs.join(', ')}.`;
        bullets.push({ text: builtText, tier: 'verified', factIds: [`${pid}:built`, ...goodTechs.map((t) => `skill:${slug(t)}`)], proof, relevance: relevanceOf(goodTechs) + 100 });
        ledger.push({ factId: `${pid}:built`, text: builtText, status: 'verified', reason: `technologies verified: ${goodTechs.join(', ')}` });

        const claims: { id: string; text: string }[] = [];
        if (p.role) claims.push({ id: `${pid}:role`, text: p.role });
        p.features.forEach((f, i) => claims.push({ id: `${pid}:feature-${i + 1}`, text: f }));
        if (!p.features.length && p.description) claims.push({ id: `${pid}:description`, text: p.description });

        for (const c of claims) {
            const problem = checkLine(c.text);
            if (problem) {
                blocked.push({ claim: c.text, kind: problem.kind, reason: problem.reason, action: problem.action });
                ledger.push({ factId: c.id, text: c.text, status: 'blocked', reason: problem.reason });
                continue;
            }
            const text = sentence(c.text);
            const mentioned = findSkillMentions(c.text).map((m) => m.skill);
            bullets.push({ text, tier: 'self_reported', factIds: [c.id], proof: [{ kind: 'resume', label: `Project "${p.title}" as described by the student` }], relevance: relevanceOf(mentioned) });
            ledger.push({ factId: c.id, text, status: 'self_reported', reason: 'described by the student; contains no unverified skill or unverifiable figure' });
        }

        const [first, ...rest] = bullets;
        rest.sort((a, b) => b.relevance - a.relevance);
        const kept = [first!, ...rest.slice(0, MAX_BULLETS_PER_PROJECT - 1)];
        for (const dropped of rest.slice(MAX_BULLETS_PER_PROJECT - 1)) {
            const e = ledger.find((l) => l.factId === dropped.factIds[0]);
            if (e) {
                e.status = 'dropped_for_space';
                e.reason = 'kept the most job-relevant bullets for this project';
            }
        }
        drafts.push({ id: pid, title: p.title, link: p.repositoryUrl, bullets: kept, relevance: relevanceOf(goodTechs) });
    }
    drafts.sort((a, b) => b.relevance - a.relevance);
    const projectDrafts = drafts.slice(0, MAX_PROJECTS);
    for (const dropped of drafts.slice(MAX_PROJECTS)) {
        for (const b of dropped.bullets) {
            const e = ledger.find((l) => l.factId === b.factIds[0]);
            if (e) {
                e.status = 'dropped_for_space';
                e.reason = 'project is less relevant to this opening than the ones shown';
            }
        }
    }

    // ---- Experience --------------------------------------------------------------------------
    const experience: GeneratedResume['experience'] = [];
    input.experience.slice(0, MAX_EXPERIENCE + 2).forEach((x, i) => {
        if (!x.organization && !x.title) return;
        const eid = `exp:${i + 1}`;
        const bullets: ResumeBullet[] = [];
        x.responsibilities.forEach((r, j) => {
            const id = `${eid}:resp-${j + 1}`;
            const problem = checkLine(r);
            if (problem) {
                blocked.push({ claim: r, kind: problem.kind === 'metric' ? 'metric' : 'responsibility', reason: problem.reason, action: problem.action });
                ledger.push({ factId: id, text: r, status: 'blocked', reason: problem.reason });
                return;
            }
            const text = sentence(r);
            bullets.push({ text, tier: 'self_reported', factIds: [id], proof: [{ kind: 'resume', label: `Experience at ${x.organization ?? x.title} as described by the student` }], relevance: relevanceOf(findSkillMentions(r).map((m) => m.skill)) });
            ledger.push({ factId: id, text, status: 'self_reported', reason: 'described by the student; contains no unverified skill or unverifiable figure' });
        });
        bullets.sort((a, b) => b.relevance - a.relevance);
        for (const dropped of bullets.slice(MAX_BULLETS_PER_ROLE)) {
            const e = ledger.find((l) => l.factId === dropped.factIds[0]);
            if (e) {
                e.status = 'dropped_for_space';
                e.reason = 'kept the most job-relevant bullets for this role';
            }
        }
        const dates = [x.startDate, x.isCurrent ? 'Present' : x.endDate].filter(Boolean).join(' – ') || null;
        experience.push({ organization: x.organization ?? x.title ?? 'Experience', title: x.organization ? x.title : null, dates, bullets: bullets.slice(0, MAX_BULLETS_PER_ROLE) });
    });
    const experienceKept = experience.slice(0, MAX_EXPERIENCE);

    // ---- Education and summary ---------------------------------------------------------------
    const eduParts = [[profile.degree, profile.branch].filter(Boolean).join(' in '), profile.institution, profile.graduationYear ? String(profile.graduationYear) : null, profile.cgpa !== null ? `CGPA ${profile.cgpa}` : null].filter(Boolean);
    const education: ResumeBullet | null = eduParts.length
        ? { text: eduParts.join(', '), tier: 'self_reported', factIds: ['education'], proof: [{ kind: 'profile', label: 'Student profile' }], relevance: 0 }
        : null;
    if (education) ledger.push({ factId: 'education', text: education.text, status: 'self_reported', reason: 'from the student profile' });

    const topSkills = skills.slice(0, 4).map((s) => s.skill);
    const summary: ResumeBullet | null = topSkills.length
        ? {
              text: `${[profile.degree, profile.branch].filter(Boolean).join(' ') || 'Student'}${profile.institution ? ` at ${profile.institution}` : ''} with evidence-verified skills in ${topSkills.join(', ')}, applying for ${job.title}${job.company ? ` at ${job.company}` : ''}.`,
              tier: 'verified',
              factIds: ['education', ...skills.slice(0, 4).map((s) => s.factId)],
              proof: skills.slice(0, 4).flatMap((s) => s.proof.slice(0, 1)),
              relevance: 0,
          }
        : null;

    const result: GeneratedResume = {
        job: { title: job.title, company: job.company },
        header: {
            name: profile.name,
            email: profile.email,
            github: profile.githubUsername ? `github.com/${profile.githubUsername}` : null,
            linkedin: profile.linkedinUrl,
        },
        summary,
        skills,
        projects: projectDrafts.map(({ id, title, link, bullets }) => ({ id, title, link, bullets })),
        experience: experienceKept,
        education,
        blocked,
        ledger,
        stats: { lines: 0, maxLines: MAX_LINES, droppedForSpace: 0 },
    };

    fitToPage(result);
    return result;
}

// ---------------------------------------------------------------------------
// One-page fit: drop the least relevant content until the line budget holds
// ---------------------------------------------------------------------------

export function countLines(r: GeneratedResume): number {
    let lines = 3; // name + contact + spacing
    if (r.summary) lines += 1 + linesFor(r.summary.text);
    if (r.skills.length) lines += 1 + linesFor(r.skills.map((s) => s.skill).join(', '));
    if (r.projects.length) lines += 1;
    for (const p of r.projects) lines += 1 + p.bullets.reduce((n, b) => n + linesFor(b.text), 0);
    if (r.experience.length) lines += 1;
    for (const x of r.experience) lines += 1 + x.bullets.reduce((n, b) => n + linesFor(b.text), 0);
    if (r.education) lines += 1 + linesFor(r.education.text);
    return lines;
}

function fitToPage(r: GeneratedResume): void {
    const drop = (factIds: string[], reason: string) => {
        const e = r.ledger.find((l) => l.factId === factIds[0]);
        if (e && e.status !== 'blocked') {
            e.status = 'dropped_for_space';
            e.reason = reason;
        }
        r.stats.droppedForSpace++;
    };

    while (countLines(r) > MAX_LINES) {
        // Candidates: any bullet except a project's first line, then trailing skills, then whole projects.
        const candidates: { relevance: number; remove: () => void }[] = [];
        for (const p of r.projects) {
            p.bullets.slice(1).forEach((b, i) => candidates.push({ relevance: b.relevance, remove: () => (drop(b.factIds, 'dropped to keep the resume to one page'), p.bullets.splice(i + 1, 1)) }));
        }
        for (const x of r.experience) {
            x.bullets.forEach((b, i) => candidates.push({ relevance: b.relevance, remove: () => (drop(b.factIds, 'dropped to keep the resume to one page'), x.bullets.splice(i, 1)) }));
        }
        if (candidates.length) {
            candidates.sort((a, b) => a.relevance - b.relevance);
            candidates[0]!.remove();
            continue;
        }
        if (r.skills.length > 8) {
            const s = r.skills.pop()!;
            drop([s.factId], 'dropped to keep the resume to one page');
            continue;
        }
        if (r.projects.length > 1) {
            const p = r.projects.pop()!;
            for (const b of p.bullets) drop(b.factIds, 'dropped to keep the resume to one page');
            continue;
        }
        break; // nothing left that can be removed
    }
    r.stats.lines = countLines(r);
}

// ---------------------------------------------------------------------------
// HTML (single column, standard headings, no tables or images, prints on one A4 page)
// ---------------------------------------------------------------------------

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const proofTitle = (b: ResumeBullet) => esc(`${b.tier === 'verified' ? 'Verified' : 'Self-reported'}: ${b.proof.map((p) => p.label).join('; ') || 'student profile'}`);

export function renderResumeHtml(r: GeneratedResume): string {
    const contact = [r.header.email, r.header.github, r.header.linkedin].filter(Boolean).map((c) => esc(c!)).join(' | ');
    const li = (b: ResumeBullet) => `<li data-facts="${esc(b.factIds.join(' '))}" title="${proofTitle(b)}">${esc(b.text)}</li>`;
    const parts: string[] = [];
    parts.push(`<h1>${esc(r.header.name)}</h1>`);
    if (contact) parts.push(`<p class="contact">${contact}</p>`);
    if (r.summary) parts.push(`<h2>Summary</h2><p data-facts="${esc(r.summary.factIds.join(' '))}">${esc(r.summary.text)}</p>`);
    if (r.skills.length) parts.push(`<h2>Skills</h2><p>${r.skills.map((s) => esc(s.skill)).join(', ')}</p>`);
    if (r.projects.length) {
        parts.push('<h2>Projects</h2>');
        for (const p of r.projects) parts.push(`<h3>${esc(p.title)}${p.link ? ` <span class="link">${esc(p.link.replace(/^https?:\/\//, ''))}</span>` : ''}</h3><ul>${p.bullets.map(li).join('')}</ul>`);
    }
    if (r.experience.length) {
        parts.push('<h2>Experience</h2>');
        for (const x of r.experience) parts.push(`<h3>${esc(x.organization)}${x.title ? `, ${esc(x.title)}` : ''}${x.dates ? ` <span class="link">${esc(x.dates)}</span>` : ''}</h3><ul>${x.bullets.map(li).join('')}</ul>`);
    }
    if (r.education) parts.push(`<h2>Education</h2><p data-facts="education">${esc(r.education.text)}</p>`);

    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(r.header.name)} - Resume</title>
<style>
@page { size: A4; margin: 14mm; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; line-height: 1.3; color: #111; margin: 0 auto; max-width: 182mm; }
h1 { font-size: 18pt; margin: 0 0 2pt; }
h2 { font-size: 11pt; text-transform: uppercase; border-bottom: 1px solid #111; margin: 10pt 0 4pt; padding-bottom: 1pt; }
h3 { font-size: 10.5pt; margin: 6pt 0 2pt; }
p { margin: 2pt 0; }
ul { margin: 2pt 0 2pt 16pt; padding: 0; }
li { margin: 1pt 0; }
.contact, .link { font-weight: normal; color: #444; font-size: 9.5pt; }
</style></head><body>${parts.join('')}</body></html>`;
}
