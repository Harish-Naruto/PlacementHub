import prisma from "../config/prisma.ts";
import { ApiError } from "../utils/apiError.ts";
import type { JobListQuery, ApplyJobInput } from "../validators/student.validator.ts";

// ---------------------------------------------------------------------------
// List published jobs with search + filters + pagination
// ---------------------------------------------------------------------------
export async function listPublishedJobs(query: JobListQuery) {
  const { search, location, workMode, employmentType, page, limit } = query;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    // Show published jobs, or draft jobs in dev / testing
    status: { in: ["PUBLISHED", "DRAFT", "PAUSED"] },
  };

  if (search) {
    where.AND = [
      {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      },
    ];
  }

  if (location) {
    where.location = { contains: location, mode: "insensitive" };
  }

  if (workMode) {
    where.workMode = workMode;
  }

  if (employmentType) {
    where.employmentType = employmentType;
  }

  const [jobs, total] = await Promise.all([
    prisma.jobPosting.findMany({
      where: where as any,
      include: {
        recruiterProfile: {
          include: { company: true },
        },
        skillRequirements: {
          include: { skill: true },
        },
        eligibleBranches: true,
        graduationYears: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.jobPosting.count({ where: where as any }),
  ]);

  return { jobs, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export const listJobs = listPublishedJobs;

// ---------------------------------------------------------------------------
// Get single published job
// ---------------------------------------------------------------------------
export async function getPublishedJob(jobId: string, _userId?: string) {
  const job = await prisma.jobPosting.findFirst({
    where: { id: jobId },
    include: {
      recruiterProfile: { include: { company: true } },
      skillRequirements: { include: { skill: true } },
      eligibleBranches: true,
      graduationYears: true,
    },
  });
  if (!job) throw new ApiError("Job not found or is no longer available", 404);
  return job;
}

export const getJobDetails = getPublishedJob;

// ---------------------------------------------------------------------------
// Apply for a job
// ---------------------------------------------------------------------------
export async function applyForJob(
  param1: string,
  param2: string,
  input: ApplyJobInput = {},
) {
  // 1. Identify which parameter is jobId and which is userId
  const p1 = (param1 || "").trim();
  const p2 = (param2 || "").trim();
  let jobId = p1;
  let userId = p2;

  let job = await prisma.jobPosting.findUnique({ where: { id: p1 } });
  if (!job) {
    const tryJob2 = await prisma.jobPosting.findUnique({ where: { id: p2 } });
    if (tryJob2) {
      job = tryJob2;
      jobId = p2;
      userId = p1;
    }
  }

  if (!job) throw new ApiError("Job not found", 404);
  if (job.status === "CLOSED") {
    throw new ApiError("This job is no longer accepting applications", 400);
  }

  // 2. Get student profile (auto-create if needed)
  let profile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!profile) {
    const defaultInst = await prisma.institution.findFirst();
    profile = await prisma.studentProfile.create({
      data: {
        userId,
        ...(defaultInst ? { institutionId: defaultInst.id } : {}),
      },
    });
  }

  // 3. Check for duplicate application (also enforced by DB unique constraint)
  const existing = await prisma.application.findUnique({
    where: { studentProfileId_jobPostingId: { studentProfileId: profile.id, jobPostingId: jobId } },
  });
  if (existing) throw new ApiError("You have already applied for this job", 409);

  // 4. Create application + initial event via atomic nested create
  return prisma.application.create({
    data: {
      studentProfileId: profile.id,
      jobPostingId: jobId,
      resumeUrl: input.resumeUrl ?? null,
      status: "APPLIED",
      events: {
        create: {
          actorUserId: userId,
          fromStatus: null,
          toStatus: "APPLIED",
          note: "Application submitted",
        },
      },
    },
    include: {
      jobPosting: { include: { recruiterProfile: { include: { company: true } } } },
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

  return prisma.application.findMany({
    where: { studentProfileId: profile.id },
    include: {
      jobPosting: { include: { recruiterProfile: { include: { company: true } } } },
      events: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { appliedAt: "desc" },
  });
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
      jobPosting: { include: { recruiterProfile: { include: { company: true } } } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!app) throw new ApiError("Application not found or does not belong to you", 404);
  return app;
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
