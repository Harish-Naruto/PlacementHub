// Editing and status changes for an opening. Used by recruiters (own jobs only) and the placement team (any job).

import prisma from "../config/prisma.ts";
import { ApiError } from "../utils/apiError.ts";
import { dedupeKey } from "../jobs/dedupe.ts";
import { JOB_INCLUDE } from "./ingest.service.ts";
import { resolveOrCreateSkill } from "./skill.service.ts";

export interface JobPatch {
  title?: string;
  description?: string;
  location?: string | null;
  workMode?: "ONSITE" | "HYBRID" | "REMOTE";
  employmentType?: "FULL_TIME" | "INTERNSHIP" | "CONTRACT" | "PART_TIME";
  minimumCgpa?: number | null;
  applicationDeadline?: string | null;
  externalUrl?: string | null;
  required?: string[];
  preferred?: string[];
  eligibleBranches?: string[];
  graduationYears?: number[];
}

type JobStatus = "DRAFT" | "PUBLISHED" | "PAUSED" | "CLOSED";

/** `recruiterProfileId` limits the change to that recruiter's own jobs (404 otherwise, never 403). */
async function loadScoped(jobId: string, recruiterProfileId?: string) {
  const job = await prisma.jobPosting.findUnique({ where: { id: jobId }, include: JOB_INCLUDE });
  if (!job || (recruiterProfileId && job.recruiterProfileId !== recruiterProfileId)) throw new ApiError("Job not found", 404);
  return job;
}

export const getScopedJob = loadScoped;

export async function updateJobDetails(jobId: string, patch: JobPatch, recruiterProfileId?: string) {
  const job = await loadScoped(jobId, recruiterProfileId);

  let skillRows: { skillId: string; requirementType: "REQUIRED" | "PREFERRED"; weight: number }[] | null = null;
  if (patch.required || patch.preferred) {
    const required = patch.required ?? job.skillRequirements.filter((r) => r.requirementType === "REQUIRED").map((r) => r.skill.name);
    const preferred = patch.preferred ?? job.skillRequirements.filter((r) => r.requirementType === "PREFERRED").map((r) => r.skill.name);
    const resolved = new Map<string, { skillId: string; requirementType: "REQUIRED" | "PREFERRED"; weight: number }>();
    for (const [names, type] of [[preferred, "PREFERRED"], [required, "REQUIRED"]] as const) {
      for (const name of names) {
        if (!name.trim()) continue;
        const skill = await resolveOrCreateSkill(name);
        const prev = job.skillRequirements.find((r) => r.skillId === skill.id);
        resolved.set(skill.id, { skillId: skill.id, requirementType: type, weight: prev ? Number(prev.weight) : 1 });
      }
    }
    skillRows = [...resolved.values()];
  }

  const deadline = patch.applicationDeadline === undefined ? undefined : patch.applicationDeadline === null ? null : new Date(patch.applicationDeadline);
  if (deadline && Number.isNaN(deadline.getTime())) throw new ApiError("Invalid application deadline", 400);

  const title = patch.title ?? job.title;
  const location = patch.location === undefined ? job.location : patch.location;

  await prisma.$transaction(async (tx) => {
    await tx.jobPosting.update({
      where: { id: jobId },
      data: {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.location !== undefined ? { location: patch.location } : {}),
        ...(patch.workMode ? { workMode: patch.workMode } : {}),
        ...(patch.employmentType ? { employmentType: patch.employmentType } : {}),
        ...(patch.minimumCgpa !== undefined ? { minimumCgpa: patch.minimumCgpa } : {}),
        ...(deadline !== undefined ? { applicationDeadline: deadline } : {}),
        ...(patch.externalUrl !== undefined ? { externalUrl: patch.externalUrl } : {}),
        // The key follows the title and place, so later postings still match the edited opening.
        ...(patch.title !== undefined || patch.location !== undefined
          ? { dedupeKey: dedupeKey({ company: job.company?.name ?? job.recruiterProfile?.company.name ?? null, title, location }) }
          : {}),
      },
    });
    if (skillRows) {
      await tx.jobSkillRequirement.deleteMany({ where: { jobPostingId: jobId } });
      await tx.jobSkillRequirement.createMany({ data: skillRows.map((r) => ({ jobPostingId: jobId, ...r })) });
    }
    if (patch.eligibleBranches) {
      await tx.jobEligibleBranch.deleteMany({ where: { jobPostingId: jobId } });
      await tx.jobEligibleBranch.createMany({ data: [...new Set(patch.eligibleBranches)].map((branch) => ({ jobPostingId: jobId, branch })) });
    }
    if (patch.graduationYears) {
      await tx.jobEligibleGraduationYear.deleteMany({ where: { jobPostingId: jobId } });
      await tx.jobEligibleGraduationYear.createMany({ data: [...new Set(patch.graduationYears)].map((graduationYear) => ({ jobPostingId: jobId, graduationYear })) });
    }
  });

  return loadScoped(jobId, recruiterProfileId);
}

/** What stops a job from being published. */
export function publishProblems(job: { title: string; description: string; applicationDeadline: Date | null; skillRequirements: { requirementType: string }[] }): string[] {
  const problems: string[] = [];
  if (!job.title.trim()) problems.push("a title is required");
  if (!job.description.trim()) problems.push("a description is required");
  if (!job.skillRequirements.some((r) => r.requirementType === "REQUIRED")) problems.push("at least one required skill is needed");
  if (job.applicationDeadline && job.applicationDeadline.getTime() < Date.now()) problems.push("the application deadline is in the past");
  return problems;
}

const ALLOWED: Record<JobStatus, JobStatus[]> = {
  DRAFT: ["PUBLISHED", "CLOSED"],
  PUBLISHED: ["PAUSED", "CLOSED"],
  PAUSED: ["PUBLISHED", "CLOSED"],
  CLOSED: [],
};

export async function setJobStatus(jobId: string, to: JobStatus, recruiterProfileId?: string) {
  const job = await loadScoped(jobId, recruiterProfileId);
  if (job.status === to) return job;
  if (!ALLOWED[job.status].includes(to)) throw new ApiError(`A ${job.status.toLowerCase()} job cannot become ${to.toLowerCase()}`, 409, true, "INVALID_JOB_STATUS");
  if (to === "PUBLISHED") {
    const problems = publishProblems(job);
    if (problems.length) throw new ApiError(`Cannot publish: ${problems.join("; ")}`, 422, true, "CANNOT_PUBLISH");
  }
  await prisma.jobPosting.update({ where: { id: jobId }, data: { status: to } });
  return loadScoped(jobId, recruiterProfileId);
}

export async function deleteDraftJob(jobId: string, recruiterProfileId: string) {
  const job = await loadScoped(jobId, recruiterProfileId);
  const applications = await prisma.application.count({ where: { jobPostingId: jobId } });
  if (job.status !== "DRAFT" || applications > 0) throw new ApiError("Only a draft with no applications can be deleted. Close the job instead.", 409, true, "CANNOT_DELETE");
  await prisma.jobPosting.delete({ where: { id: jobId } });
  return { deleted: true };
}
