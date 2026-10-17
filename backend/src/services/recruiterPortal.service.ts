// Recruiter portal: company profile, own openings, a ranked evidence-backed shortlist, and status changes.
// Every query is scoped to the recruiter's own jobs. Another recruiter's data is a 404, never a 403.

import prisma from "../config/prisma.ts";
import { ApiError } from "../utils/apiError.ts";
import { findDuplicate, normalizeCompany } from "../jobs/dedupe.ts";
import { parseJobRules, type ParsedJob } from "../jobs/parseJob.ts";
import { computeFit } from "../matching/fit.ts";
import { rankCandidates } from "../matching/rank.ts";
import { STAGES, stageOf, type ApplicationStatus, type Stage } from "../pipeline/transitions.ts";
import { canonicalOrSelf } from "../skills/canonical.ts";
import { createJobRecord, JOB_INCLUDE, parsePostingText, resolveCompany } from "./ingest.service.ts";
import { deleteDraftJob, getScopedJob, setJobStatus, updateJobDetails, type JobPatch } from "./jobAdmin.service.ts";
import { jobToInput, loadStudentsByProfileIds } from "./match.service.ts";
import { changeApplicationStatus, getApplicationDetail } from "./pipeline.service.ts";
import { withCompany } from "./job.service.ts";
import type { JobPatchInput } from "../validators/portal.validator.ts";

// ---------------------------------------------------------------------------
// Profile and company
// ---------------------------------------------------------------------------

export async function getRecruiterContext(userId: string) {
  const profile = await prisma.recruiterProfile.findUnique({ where: { userId }, include: { company: true } });
  if (!profile) throw new ApiError("Set up your company profile first", 409, true, "RECRUITER_PROFILE_REQUIRED");
  return profile;
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, email: true } });
  const profile = await prisma.recruiterProfile.findUnique({ where: { userId }, include: { company: true } });
  return { user, profile };
}

export interface ProfileInput {
  companyName: string;
  website?: string | null;
  city?: string | null;
  country?: string | null;
  description?: string | null;
  jobTitle?: string | null;
}

export async function upsertProfile(userId: string, input: ProfileInput) {
  const existing = await prisma.recruiterProfile.findUnique({ where: { userId }, include: { company: true } });

  if (existing) {
    // Renaming to a different company is not allowed: jobs and applicants belong to the company they were posted under.
    if (normalizeCompany(input.companyName) !== normalizeCompany(existing.company.name) && input.companyName.trim().toLowerCase() !== existing.company.name.toLowerCase()) {
      throw new ApiError("You cannot move your account to a different company. Ask the placement team to help.", 409, true, "COMPANY_LOCKED");
    }
    await prisma.$transaction([
      prisma.company.update({
        where: { id: existing.companyId },
        data: {
          ...(input.website !== undefined ? { website: input.website } : {}),
          ...(input.city !== undefined ? { city: input.city } : {}),
          ...(input.country !== undefined ? { country: input.country } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
        },
      }),
      prisma.recruiterProfile.update({ where: { id: existing.id }, data: { ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}) } }),
    ]);
    return getProfile(userId);
  }

  // Joins the company if the placement team already created it from an ingested posting, otherwise creates it.
  const company = await resolveCompany(input.companyName, userId);
  await prisma.company.updateMany({
    where: { id: company.id, website: null },
    data: { ...(input.website ? { website: input.website } : {}), ...(input.city ? { city: input.city } : {}), ...(input.country ? { country: input.country } : {}), ...(input.description ? { description: input.description } : {}) },
  });
  await prisma.recruiterProfile.create({ data: { userId, companyId: company.id, jobTitle: input.jobTitle ?? null } });
  return getProfile(userId);
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export async function listJobs(userId: string, status?: string) {
  const ctx = await getRecruiterContext(userId);
  const jobs = await prisma.jobPosting.findMany({
    where: { recruiterProfileId: ctx.id, ...(status ? { status: status as never } : {}) },
    include: JOB_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  const counts = await prisma.application.groupBy({ by: ["jobPostingId", "status"], where: { jobPostingId: { in: jobs.map((j) => j.id) } }, _count: true });
  return jobs.map((job) => {
    const stages: Record<Stage, number> = { Applied: 0, Interview: 0, Offer: 0, Closed: 0 };
    for (const c of counts.filter((x) => x.jobPostingId === job.id)) stages[stageOf(c.status)] += c._count;
    return { ...withCompany(job), applicants: Object.values(stages).reduce((a, b) => a + b, 0), applicantsByStage: stages };
  });
}

export async function getJob(userId: string, jobId: string) {
  const ctx = await getRecruiterContext(userId);
  return withCompany(await getScopedJob(jobId, ctx.id));
}

/** Builds the posting from a pasted description, explicit fields, or both (explicit fields win). */
async function toParsedJob(body: JobPatchInput & { jobDescription?: string }, companyName: string): Promise<ParsedJob> {
  const base: ParsedJob = body.jobDescription
    ? await parsePostingText(body.jobDescription, { title: body.title, company: companyName, location: body.location ?? undefined })
    : { ...parseJobRules(body.description ?? "", { title: body.title, company: companyName, location: body.location ?? undefined }), parseMethod: "rules" };

  const required = body.required ? body.required.map(canonicalOrSelf) : base.required;
  const preferred = (body.preferred ? body.preferred.map(canonicalOrSelf) : base.preferred).filter((p) => !required.includes(p));
  return {
    ...base,
    title: body.title ?? base.title,
    company: companyName,
    location: body.location === undefined ? base.location : body.location,
    workMode: body.workMode ?? base.workMode,
    employmentType: body.employmentType ?? base.employmentType,
    minCgpa: body.minimumCgpa === undefined ? base.minCgpa : body.minimumCgpa,
    eligibleBranches: body.eligibleBranches ?? base.eligibleBranches,
    graduationYears: body.graduationYears ?? base.graduationYears,
    deadline: body.applicationDeadline === undefined ? base.deadline : body.applicationDeadline ? new Date(body.applicationDeadline).toISOString() : null,
    description: body.description ?? base.description,
    required,
    preferred,
  };
}

export async function createJob(userId: string, body: JobPatchInput & { jobDescription?: string }) {
  const ctx = await getRecruiterContext(userId);
  if (!body.jobDescription && !(body.title && body.description)) {
    throw new ApiError("Provide a jobDescription to parse, or a title and a description", 400);
  }
  const parsed = await toParsedJob(body, ctx.company.name);

  // Warn (never block) when the same company already has this opening, e.g. from the placement team's ingest.
  const sameCompany = await prisma.jobPosting.findMany({
    where: { companyId: ctx.companyId },
    select: { id: true, title: true, location: true, dedupeKey: true, skillRequirements: { select: { skill: { select: { name: true } } } } },
  });
  const duplicate = findDuplicate(
    { company: ctx.company.name, title: parsed.title, location: parsed.location, skills: [...parsed.required, ...parsed.preferred] },
    sameCompany.map((e) => ({ id: e.id, company: ctx.company.name, title: e.title, location: e.location, dedupeKey: e.dedupeKey, skills: e.skillRequirements.map((r) => r.skill.name) })),
  );

  const job = await createJobRecord({
    parsed,
    companyId: ctx.companyId,
    recruiterProfileId: ctx.id,
    source: { sourceType: "RECRUITER_POSTED", sourceLabel: `${ctx.company.name} recruiter` },
    status: "DRAFT",
  });
  return {
    job: withCompany(job),
    parseMethod: parsed.parseMethod,
    possibleDuplicate: duplicate.kind === "none" ? null : { jobId: duplicate.jobId, kind: duplicate.kind, similarity: duplicate.similarity },
  };
}

export async function updateJob(userId: string, jobId: string, patch: JobPatch) {
  const ctx = await getRecruiterContext(userId);
  return withCompany(await updateJobDetails(jobId, patch, ctx.id));
}

export async function changeJobStatus(userId: string, jobId: string, to: "PUBLISHED" | "PAUSED" | "CLOSED") {
  const ctx = await getRecruiterContext(userId);
  return withCompany(await setJobStatus(jobId, to, ctx.id));
}

export async function removeDraft(userId: string, jobId: string) {
  const ctx = await getRecruiterContext(userId);
  return deleteDraftJob(jobId, ctx.id);
}

// ---------------------------------------------------------------------------
// Applicants: ranked shortlist
// ---------------------------------------------------------------------------

export interface ApplicantsQuery {
  stage?: Stage;
  minFit?: number;
  eligibleOnly?: boolean;
}

export async function listApplicants(userId: string, jobId: string, query: ApplicantsQuery) {
  const ctx = await getRecruiterContext(userId);
  const job = await getScopedJob(jobId, ctx.id);
  const input = jobToInput(job);

  const apps = await prisma.application.findMany({
    where: { jobPostingId: jobId, ...(query.stage ? { status: { in: STAGES[query.stage] } } : {}) },
    select: { id: true, studentProfileId: true, status: true, appliedAt: true, updatedAt: true, fitScore: true, resumeSnapshot: true },
  });
  const students = await loadStudentsByProfileIds(apps.map((a) => a.studentProfileId));
  const byProfile = new Map(students.map((s) => [s.profileId, s]));

  const rows = apps.flatMap((a) => {
    const s = byProfile.get(a.studentProfileId);
    if (!s) return [];
    const fit = computeFit(s.input, input);
    const snapshot = a.resumeSnapshot as { claimSummary?: { flagged: number; total: number } | null } | null;
    return [
      {
        applicationId: a.id,
        status: a.status as ApplicationStatus,
        stage: stageOf(a.status),
        appliedAt: a.appliedAt,
        updatedAt: a.updatedAt,
        studentProfileId: s.profileId,
        name: s.name,
        email: s.email,
        institution: s.institution,
        branch: s.branch,
        cgpa: s.cgpa,
        graduationYear: s.graduationYear,
        githubUsername: s.githubUsername,
        fitAtApply: a.fitScore,
        claimCheck: snapshot?.claimSummary ?? null,
        verifiedSkills: s.verifiedSkills,
        flaggedSkills: s.flaggedSkills,
        fit,
      },
    ];
  });

  const filtered = rows.filter((r) => (query.minFit === undefined || (r.fit.fitScore ?? -1) >= query.minFit) && (!query.eligibleOnly || r.fit.eligibility.eligible));
  const ranked = rankCandidates(filtered);
  return {
    job: { id: job.id, title: job.title, status: job.status, required: job.skillRequirements.filter((r) => r.requirementType === "REQUIRED").map((r) => r.skill.name), preferred: job.skillRequirements.filter((r) => r.requirementType === "PREFERRED").map((r) => r.skill.name) },
    total: rows.length,
    rows: ranked.map(({ fit, ...r }) => ({
      ...r,
      fitScore: fit.fitScore,
      band: fit.band,
      eligible: fit.eligibility.eligible,
      eligibilityFlags: fit.eligibility.flags,
      matched: fit.matched.map((m) => ({ skill: m.skill, requirement: m.requirement, combinedScore: m.combinedScore })),
      gaps: fit.gaps.map((g) => ({ skill: g.skill, requirement: g.requirement, kind: g.kind, detail: g.detail })),
      explanation: fit.explanation,
    })),
  };
}

/** One applicant, with proof behind every skill, the resume that was sent and the status history. */
export async function getApplicant(userId: string, applicationId: string) {
  const ctx = await getRecruiterContext(userId);
  const detail = await getApplicationDetail(applicationId, ctx.id);

  const [full, skills, job] = await Promise.all([
    prisma.application.findUniqueOrThrow({ where: { id: applicationId }, select: { fitScore: true, fitSnapshot: true, resumeSnapshot: true } }),
    prisma.studentSkill.findMany({
      where: { studentProfileId: detail.studentProfile.id },
      include: { skill: { select: { name: true } }, evidence: { where: { sourceType: { in: ["ASSESSMENT", "GITHUB_REPOSITORY"] } }, select: { sourceType: true, sourceUrl: true, description: true, status: true } } },
    }),
    getScopedJob(detail.jobPosting.id, ctx.id),
  ]);
  const [student] = await loadStudentsByProfileIds([detail.studentProfile.id]);
  const fitNow = student ? computeFit(student.input, jobToInput(job)) : null;

  return {
    application: detail,
    fitAtApply: { score: full.fitScore, snapshot: full.fitSnapshot },
    fitNow,
    resumeSnapshot: full.resumeSnapshot,
    skills: skills
      .map((s) => ({
        skill: s.skill.name,
        status: s.verificationStatus,
        assessmentScore: s.assessmentScore,
        githubScore: s.githubScore,
        combinedScore: s.combinedScore,
        evidenceStrength: s.evidenceStrength,
        proof: s.evidence,
      }))
      .sort((a, b) => (b.combinedScore ?? -1) - (a.combinedScore ?? -1) || a.skill.localeCompare(b.skill)),
  };
}

export async function updateApplicationStatus(userId: string, applicationId: string, to: ApplicationStatus, note?: string) {
  const ctx = await getRecruiterContext(userId);
  return changeApplicationStatus({ applicationId, actorUserId: userId, to, note, recruiterProfileId: ctx.id });
}
