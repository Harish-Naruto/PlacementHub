import prisma from "../config/prisma.ts";
import { ApiError } from "../utils/apiError.ts";
import type { JobListQuery, ApplyJobInput } from "../validators/student.validator.ts";
import { computeFit } from "../matching/fit.ts";
import { fitBriefsForJobs, jobToInput, loadStudentByUser } from "./match.service.ts";
import { generateResumeForJob, latestClaimSummary } from "./resumeBuilder.service.ts";

const JOB_CARD_INCLUDE = {
  company: true,
  recruiterProfile: { include: { company: true } },
  skillRequirements: { include: { skill: true } },
  eligibleBranches: true,
  graduationYears: true,
  sources: { select: { sourceType: true, sourceLabel: true, sourceUrl: true, importedAt: true } },
};

/** Ingested jobs have a company but no recruiter; recruiter-posted jobs have both. Expose one `company`. */
export function withCompany<T extends { company?: { id: string; name: string } | null; recruiterProfile?: { company: { id: string; name: string } } | null }>(job: T) {
  return { ...job, company: job.company ?? job.recruiterProfile?.company ?? null };
}

// ---------------------------------------------------------------------------
// List published jobs with search + filters + pagination
// ---------------------------------------------------------------------------
export async function listPublishedJobs(query: JobListQuery, userId?: string) {
  const { search, location, workMode, employmentType, page, limit } = query;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { status: "PUBLISHED" };

  if (search) {
    where.AND = [
      {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { company: { name: { contains: search, mode: "insensitive" } } },
          { skillRequirements: { some: { skill: { name: { contains: search, mode: "insensitive" } } } } },
        ],
      },
    ];
  }
  if (location) where.location = { contains: location, mode: "insensitive" };
  if (workMode) where.workMode = workMode;
  if (employmentType) where.employmentType = employmentType;

  const [jobs, total] = await Promise.all([
    prisma.jobPosting.findMany({
      where: where as never,
      include: JOB_CARD_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.jobPosting.count({ where: where as never }),
  ]);

  // With `userId` every card carries the student's evidence-backed fit for that opening.
  const fits = userId && query.withFit ? await fitBriefsForJobs(userId, jobs) : null;
  const data = jobs.map((j) => ({ ...withCompany(j), ...(fits ? { fit: fits.get(j.id) ?? null } : {}) }));
  if (fits) data.sort((a, b) => Number(b.fit?.eligible ?? false) - Number(a.fit?.eligible ?? false) || (b.fit?.fitScore ?? -1) - (a.fit?.fitScore ?? -1));

  return { jobs: data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export const listJobs = listPublishedJobs;

// ---------------------------------------------------------------------------
// Get single job (anything that is not a draft can be viewed)
// ---------------------------------------------------------------------------
export async function getPublishedJob(jobId: string, _userId?: string) {
  const job = await prisma.jobPosting.findFirst({
    where: { id: jobId, status: { not: "DRAFT" } },
    include: JOB_CARD_INCLUDE,
  });
  if (!job) throw new ApiError("Job not found or is no longer available", 404);
  return withCompany(job);
}

export const getJobDetails = getPublishedJob;

// ---------------------------------------------------------------------------
// Apply for a job
// ---------------------------------------------------------------------------
export async function applyForJob(jobId: string, userId: string, input: ApplyJobInput = {}) {
  const job = await prisma.jobPosting.findUnique({
    where: { id: jobId },
    include: { skillRequirements: { include: { skill: true } }, eligibleBranches: true, graduationYears: true },
  });
  if (!job) throw new ApiError("Job not found", 404);
  if (job.status !== "PUBLISHED") throw new ApiError("This job is not accepting applications", 400);

  const student = await loadStudentByUser(userId);
  if (!student) throw new ApiError("Complete your student profile before applying", 409, true, "PROFILE_REQUIRED");

  // Eligibility is a hard rule: a student outside the CGPA, branch, batch or deadline rules cannot apply.
  const fit = computeFit(student.input, jobToInput(job));
  if (!fit.eligibility.eligible) {
    throw new ApiError(`You are not eligible for this opening: ${fit.eligibility.flags.join("; ")}`, 422, true, "NOT_ELIGIBLE");
  }

  const existing = await prisma.application.findUnique({
    where: { studentProfileId_jobPostingId: { studentProfileId: student.profileId, jobPostingId: jobId } },
    select: { id: true },
  });
  if (existing) throw new ApiError("You have already applied for this job", 409);

  // Snapshot what the student and the reviewers see: the fit now, and the evidence-backed resume sent.
  // A failure here must not block applying.
  let resumeSnapshot: object | null = null;
  try {
    const [generated, claims] = await Promise.all([generateResumeForJob(userId, jobId), latestClaimSummary(userId).catch(() => null)]);
    resumeSnapshot = { generatedAt: new Date().toISOString(), resume: generated.resume, claimSummary: claims };
  } catch (err) {
    console.warn("[Apply] resume snapshot failed:", err instanceof Error ? err.message : err);
  }

  return prisma.application.create({
    data: {
      studentProfileId: student.profileId,
      jobPostingId: jobId,
      resumeUrl: input.resumeUrl ?? null,
      status: "APPLIED",
      fitScore: fit.fitScore,
      fitSnapshot: { band: fit.band, matched: fit.matched, gaps: fit.gaps, eligibility: fit.eligibility, explanation: fit.explanation, requiredTotal: fit.requiredTotal, requiredDemonstrated: fit.requiredDemonstrated } as object,
      resumeSnapshot: resumeSnapshot ?? undefined,
      events: { create: { actorUserId: userId, fromStatus: null, toStatus: "APPLIED", note: "Application submitted" } },
    },
    omit: { resumeSnapshot: true },
    include: {
      jobPosting: { include: { company: true, recruiterProfile: { include: { company: true } } } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
}

export const applyJob = applyForJob;

// ---------------------------------------------------------------------------
// List student applications
// ---------------------------------------------------------------------------
export async function getStudentApplications(userId: string) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!profile) return [];

  const apps = await prisma.application.findMany({
    where: { studentProfileId: profile.id },
    omit: { resumeSnapshot: true },
    include: {
      jobPosting: { include: { company: true, recruiterProfile: { include: { company: true } } } },
      events: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { appliedAt: "desc" },
  });
  return apps.map((a) => ({ ...a, jobPosting: withCompany(a.jobPosting) }));
}

// ---------------------------------------------------------------------------
// Get single application (ownership check)
// ---------------------------------------------------------------------------
export async function getStudentApplication(userId: string, applicationId: string) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!profile) throw new ApiError("Student profile not found", 404);

  const app = await prisma.application.findFirst({
    where: { id: applicationId, studentProfileId: profile.id },
    include: {
      jobPosting: { include: { company: true, recruiterProfile: { include: { company: true } } } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!app) throw new ApiError("Application not found or does not belong to you", 404);
  return { ...app, jobPosting: withCompany(app.jobPosting) };
}

// ---------------------------------------------------------------------------
// Withdraw application
// ---------------------------------------------------------------------------
export async function withdrawApplication(userId: string, applicationId: string) {
  const app = await getStudentApplication(userId, applicationId);

  if (app.status === "WITHDRAWN") throw new ApiError("Application already withdrawn", 400);
  if (["HIRED", "REJECTED"].includes(app.status)) {
    throw new ApiError(`Cannot withdraw an application with status: ${app.status}`, 400);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.application.update({
      where: { id: applicationId },
      data: { status: "WITHDRAWN" },
      omit: { resumeSnapshot: true },
    });

    await tx.applicationEvent.create({
      data: {
        applicationId,
        actorUserId: userId,
        fromStatus: app.status,
        toStatus: "WITHDRAWN",
        note: "Application withdrawn by student",
      },
    });

    return updated;
  });
}
