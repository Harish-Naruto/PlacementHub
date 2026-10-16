import prisma from "../config/prisma.ts";
import { ApiError } from "../utils/apiError.ts";
import type {
  UpsertCompanyInput,
  CreateJobInput,
  UpdateJobInput,
  UpdateApplicationStatusInput,
} from "../validators/recruiter.validator.ts";
import type {
  ApplicationStatus,
  JobStatus,
} from "../../generated/prisma/client.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Load the authenticated recruiter's profile or throw 404.
 * Also returns the associated company.
 */
export async function getRecruiterProfileOrThrow(userId: string) {
  const profile = await prisma.recruiterProfile.findUnique({
    where: { userId },
    include: {
      company: true,
    },
  });
  if (!profile) {
    throw new ApiError(
      "Recruiter profile not found. Please complete your profile first.",
      404,
    );
  }
  return profile;
}

/**
 * Verify that a job belongs to the authenticated recruiter.
 * Returns the job or throws 404/403.
 */
export async function getOwnedJobOrThrow(
  jobId: string,
  recruiterProfileId: string,
) {
  const job = await prisma.jobPosting.findUnique({
    where: { id: jobId },
    include: {
      eligibleBranches: true,
      graduationYears: true,
      skillRequirements: {
        include: { skill: true },
      },
    },
  });
  if (!job) {
    throw new ApiError("Job not found", 404);
  }
  if (job.recruiterProfileId !== recruiterProfileId) {
    throw new ApiError("You do not have permission to access this job", 403);
  }
  return job;
}

/**
 * Verify that an application belongs to a job owned by the recruiter.
 */
export async function getOwnedApplicationOrThrow(
  applicationId: string,
  recruiterProfileId: string,
) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      jobPosting: {
        include: {
          eligibleBranches: true,
          graduationYears: true,
          skillRequirements: { include: { skill: true } },
        },
      },
      studentProfile: {
        include: {
          user: {
            select: { id: true, email: true, name: true, profileImage: true },
          },
          institution: true,
          skills: {
            include: {
              skill: true,
              evidence: true,
            },
          },
          projects: {
            where: { status: { not: "DRAFT" } },
            include: { skills: { include: { skill: true } } },
          },
        },
      },
      events: {
        orderBy: { createdAt: "asc" },
        include: {
          actor: { select: { id: true, name: true, email: true, role: true } },
        },
      },
    },
  });

  if (!application) {
    throw new ApiError("Application not found", 404);
  }
  if (application.jobPosting.recruiterProfileId !== recruiterProfileId) {
    throw new ApiError(
      "You do not have permission to access this application",
      403,
    );
  }
  return application;
}

// ---------------------------------------------------------------------------
// Slug generation
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniqueCompanySlug(base: string): Promise<string> {
  let slug = base;
  let attempt = 0;
  while (true) {
    const existing = await prisma.company.findUnique({ where: { slug } });
    if (!existing) return slug;
    attempt++;
    slug = `${base}-${attempt}`;
  }
}

// ---------------------------------------------------------------------------
// Recruiter profile
// ---------------------------------------------------------------------------

/**
 * GET /recruiters/me/profile
 * Returns the recruiter's profile with company details, or null if not set up.
 */
export async function getProfile(userId: string) {
  const profile = await prisma.recruiterProfile.findUnique({
    where: { userId },
    include: { company: true },
  });
  return profile;
}

/**
 * PUT /recruiters/me/profile
 * Creates or updates the recruiter profile and associated company.
 * If the recruiter already has a profile + company, update both.
 * If no profile exists, create a new company (or attach to existing by slug)
 * and create the profile.
 */
export async function upsertProfile(
  userId: string,
  input: UpsertCompanyInput,
) {
  const {
    companyName,
    companySlug,
    website,
    description,
    city,
    country,
    jobTitle,
  } = input;

  const existing = await prisma.recruiterProfile.findUnique({
    where: { userId },
    include: { company: true },
  });

  if (existing) {
    // Update existing profile + company
    const updatedCompany = await prisma.company.update({
      where: { id: existing.companyId },
      data: {
        name: companyName,
        ...(companySlug ? { slug: companySlug } : {}),
        ...(website !== undefined ? { website: website || null } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(city !== undefined ? { city } : {}),
        ...(country !== undefined ? { country } : {}),
      },
    });

    const updatedProfile = await prisma.recruiterProfile.update({
      where: { userId },
      data: {
        ...(jobTitle !== undefined ? { jobTitle } : {}),
      },
      include: { company: true },
    });

    return { profile: updatedProfile, company: updatedCompany };
  }

  // No profile yet — compute unique slug first, then create company and profile in transaction
  const slug = companySlug || (await uniqueCompanySlug(slugify(companyName)));

  const result = await prisma.$transaction(
    async (tx) => {
      // Check if slug already exists (another company)
      const existingCompany = await tx.company.findUnique({ where: { slug } });

      let company;
      if (existingCompany) {
        // Re-use existing company (e.g. a second recruiter from same company)
        company = existingCompany;
      } else {
        company = await tx.company.create({
          data: {
            name: companyName,
            slug,
            website: website || null,
            description: description || null,
            city: city || null,
            country: country || null,
            createdById: userId,
          },
        });
      }

      const profile = await tx.recruiterProfile.create({
        data: {
          userId,
          companyId: company.id,
          jobTitle: jobTitle || null,
        },
        include: { company: true },
      });

      return { profile, company };
    },
    { timeout: 20000, maxWait: 10000 },
  );

  return result;
}

// ---------------------------------------------------------------------------
// Job management
// ---------------------------------------------------------------------------

/**
 * GET /recruiters/me/jobs
 * List all jobs for the authenticated recruiter with pagination.
 */
export async function listJobs(
  recruiterProfileId: string,
  page: number,
  limit: number,
  status?: JobStatus,
) {
  const skip = (page - 1) * limit;

  const where = {
    recruiterProfileId,
    ...(status ? { status } : {}),
  };

  const [jobs, total] = await Promise.all([
    prisma.jobPosting.findMany({
      where,
      include: {
        eligibleBranches: true,
        graduationYears: true,
        skillRequirements: { include: { skill: true } },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.jobPosting.count({ where }),
  ]);

  return { jobs, total, page, limit };
}

/**
 * POST /recruiters/me/jobs
 * Create a new job posting (always starts as DRAFT).
 */
export async function createJob(
  recruiterProfileId: string,
  input: CreateJobInput,
) {
  const {
    title,
    description,
    location,
    workMode,
    employmentType,
    minimumCgpa,
    applicationDeadline,
    externalUrl,
    eligibleBranches,
    eligibleGraduationYears,
    skillRequirements,
    status,
  } = input;

  // Deduplicate skill IDs
  const skillMap = new Map<string, { requirementType: "REQUIRED" | "PREFERRED"; weight: number }>();
  for (const sr of skillRequirements) {
    skillMap.set(sr.skillId, {
      requirementType: sr.requirementType,
      weight: sr.weight,
    });
  }

  // Validate all skill IDs exist
  if (skillMap.size > 0) {
    const skills = await prisma.skill.findMany({
      where: { id: { in: Array.from(skillMap.keys()) } },
      select: { id: true },
    });
    if (skills.length !== skillMap.size) {
      throw new ApiError("One or more skill IDs are invalid", 400);
    }
  }

  const job = await prisma.jobPosting.create({
    data: {
      recruiterProfileId,
      title,
      description,
      location: location || null,
      workMode,
      employmentType,
      minimumCgpa: minimumCgpa != null ? minimumCgpa : null,
      applicationDeadline: applicationDeadline
        ? new Date(applicationDeadline)
        : null,
      externalUrl: externalUrl || null,
      status: status ?? "DRAFT",
      eligibleBranches: {
        create: (eligibleBranches ?? []).map((branch) => ({ branch })),
      },
      graduationYears: {
        create: (eligibleGraduationYears ?? []).map((graduationYear) => ({
          graduationYear,
        })),
      },
      skillRequirements: {
        create: Array.from(skillMap.entries()).map(([skillId, val]) => ({
          skillId,
          requirementType: val.requirementType,
          weight: val.weight,
        })),
      },
    },
    include: {
      eligibleBranches: true,
      graduationYears: true,
      skillRequirements: { include: { skill: true } },
    },
  });

  return job;
}

/**
 * GET /recruiters/me/jobs/:jobId
 * Return a single owned job with full details.
 */
export async function getJob(jobId: string, recruiterProfileId: string) {
  return getOwnedJobOrThrow(jobId, recruiterProfileId);
}

/**
 * PATCH /recruiters/me/jobs/:jobId
 * Update an owned job. Only DRAFT or PAUSED jobs can be edited freely.
 * PUBLISHED jobs can be updated but not republished without re-validation.
 */
export async function updateJob(
  jobId: string,
  recruiterProfileId: string,
  input: UpdateJobInput,
) {
  const job = await getOwnedJobOrThrow(jobId, recruiterProfileId);

  if (job.status === "CLOSED") {
    throw new ApiError("Closed jobs cannot be edited", 409);
  }

  const {
    title,
    description,
    location,
    workMode,
    employmentType,
    minimumCgpa,
    applicationDeadline,
    externalUrl,
    eligibleBranches,
    eligibleGraduationYears,
    skillRequirements,
  } = input;

  // Build skill map from input if provided
  let skillMap: Map<string, { requirementType: "REQUIRED" | "PREFERRED"; weight: number }> | null = null;

  if (skillRequirements !== undefined) {
    skillMap = new Map();
    for (const sr of skillRequirements) {
      skillMap.set(sr.skillId, {
        requirementType: sr.requirementType,
        weight: sr.weight,
      });
    }

    if (skillMap.size > 0) {
      const skills = await prisma.skill.findMany({
        where: { id: { in: Array.from(skillMap.keys()) } },
        select: { id: true },
      });
      if (skills.length !== skillMap.size) {
        throw new ApiError("One or more skill IDs are invalid", 400);
      }
    }
  }

  const updated = await prisma.$transaction(
    async (tx) => {
      // Update scalar fields
    const updatedJob = await tx.jobPosting.update({
      where: { id: jobId },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(location !== undefined ? { location: location || null } : {}),
        ...(workMode !== undefined ? { workMode } : {}),
        ...(employmentType !== undefined ? { employmentType } : {}),
        ...(minimumCgpa !== undefined
          ? { minimumCgpa: minimumCgpa != null ? minimumCgpa : null }
          : {}),
        ...(applicationDeadline !== undefined
          ? {
            applicationDeadline: applicationDeadline
              ? new Date(applicationDeadline)
              : null,
          }
          : {}),
        ...(externalUrl !== undefined ? { externalUrl: externalUrl || null } : {}),
      },
    });

    // Replace eligible branches if provided
    if (eligibleBranches !== undefined) {
      await tx.jobEligibleBranch.deleteMany({ where: { jobPostingId: jobId } });
      if (eligibleBranches.length > 0) {
        await tx.jobEligibleBranch.createMany({
          data: eligibleBranches.map((branch) => ({ jobPostingId: jobId, branch })),
        });
      }
    }

    // Replace eligible graduation years if provided
    if (eligibleGraduationYears !== undefined) {
      await tx.jobEligibleGraduationYear.deleteMany({ where: { jobPostingId: jobId } });
      if (eligibleGraduationYears.length > 0) {
        await tx.jobEligibleGraduationYear.createMany({
          data: eligibleGraduationYears.map((graduationYear) => ({
            jobPostingId: jobId,
            graduationYear,
          })),
        });
      }
    }

    // Replace skill requirements if provided
    if (skillMap !== null) {
      await tx.jobSkillRequirement.deleteMany({ where: { jobPostingId: jobId } });
      if (skillMap.size > 0) {
        await tx.jobSkillRequirement.createMany({
          data: Array.from(skillMap.entries()).map(([skillId, val]) => ({
            jobPostingId: jobId,
            skillId,
            requirementType: val.requirementType,
            weight: val.weight,
          })),
        });
      }
    }

    return updatedJob;
  }, { timeout: 20000, maxWait: 10000 });

  // Return full details
  return getOwnedJobOrThrow(updated.id, recruiterProfileId);
}

/**
 * POST /recruiters/me/jobs/:jobId/publish
 * Publish a DRAFT or PAUSED job after validation.
 */
export async function publishJob(jobId: string, recruiterProfileId: string) {
  const job = await getOwnedJobOrThrow(jobId, recruiterProfileId);

  if (job.status === "PUBLISHED") {
    throw new ApiError("Job is already published", 409);
  }
  if (job.status === "CLOSED") {
    throw new ApiError("Closed jobs cannot be re-published", 409);
  }

  // Validate required fields before publishing
  if (!job.title?.trim()) {
    throw new ApiError("Job title is required before publishing", 422);
  }
  if (!job.description?.trim()) {
    throw new ApiError("Job description is required before publishing", 422);
  }

  // Deadline must be in the future if provided
  if (job.applicationDeadline && job.applicationDeadline < new Date()) {
    throw new ApiError(
      "Application deadline must be in the future before publishing",
      422,
    );
  }

  const updated = await prisma.jobPosting.update({
    where: { id: jobId },
    data: { status: "PUBLISHED" },
    include: {
      eligibleBranches: true,
      graduationYears: true,
      skillRequirements: { include: { skill: true } },
    },
  });

  return updated;
}

/**
 * POST /recruiters/me/jobs/:jobId/close
 * Close an owned job.
 */
export async function closeJob(jobId: string, recruiterProfileId: string) {
  const job = await getOwnedJobOrThrow(jobId, recruiterProfileId);

  if (job.status === "CLOSED") {
    throw new ApiError("Job is already closed", 409);
  }

  const updated = await prisma.jobPosting.update({
    where: { id: jobId },
    data: { status: "CLOSED" },
    include: {
      eligibleBranches: true,
      graduationYears: true,
      skillRequirements: { include: { skill: true } },
    },
  });

  return updated;
}

/**
 * POST /recruiters/me/jobs/:jobId/pause
 * Pause an active PUBLISHED job.
 */
export async function pauseJob(jobId: string, recruiterProfileId: string) {
  const job = await getOwnedJobOrThrow(jobId, recruiterProfileId);

  if (job.status === "PAUSED") {
    throw new ApiError("Job is already paused", 409);
  }
  if (job.status === "CLOSED") {
    throw new ApiError("Closed jobs cannot be paused", 409);
  }
  if (job.status === "DRAFT") {
    throw new ApiError("Draft jobs cannot be paused. Publish or keep as draft.", 409);
  }

  const updated = await prisma.jobPosting.update({
    where: { id: jobId },
    data: { status: "PAUSED" },
    include: {
      eligibleBranches: true,
      graduationYears: true,
      skillRequirements: { include: { skill: true } },
    },
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Application management
// ---------------------------------------------------------------------------

/**
 * GET /recruiters/me/jobs/:jobId/applications
 * List applications for a specific owned job, with student evidence summary.
 */
export async function listJobApplications(
  jobId: string,
  recruiterProfileId: string,
  page: number,
  limit: number,
  status?: ApplicationStatus,
) {
  // Verify ownership
  await getOwnedJobOrThrow(jobId, recruiterProfileId);

  const skip = (page - 1) * limit;

  const where = {
    jobPostingId: jobId,
    ...(status ? { status } : {}),
  };

  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where,
      include: {
        studentProfile: {
          include: {
            user: {
              select: { id: true, email: true, name: true, profileImage: true },
            },
            institution: { select: { id: true, name: true } },
            skills: {
              include: { skill: true, evidence: true },
            },
          },
        },
        events: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            actor: { select: { id: true, name: true, role: true } },
          },
        },
      },
      orderBy: { appliedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.application.count({ where }),
  ]);

  return { applications, total, page, limit };
}

/**
 * GET /recruiters/me/applications/:applicationId
 * View full application details including candidate evidence.
 */
export async function getApplication(
  applicationId: string,
  recruiterProfileId: string,
) {
  return getOwnedApplicationOrThrow(applicationId, recruiterProfileId);
}

/**
 * PATCH /recruiters/me/applications/:applicationId/status
 * Update application recruitment status with a validated transition.
 */

// Valid transitions map: current status → allowed next statuses
const VALID_TRANSITIONS: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
  APPLIED: ["IN_REVIEW", "REJECTED", "WITHDRAWN"],
  IN_REVIEW: ["SHORTLISTED", "REJECTED", "WITHDRAWN"],
  SHORTLISTED: ["INTERVIEW_SCHEDULED", "REJECTED", "WITHDRAWN"],
  INTERVIEW_SCHEDULED: ["INTERVIEWING", "REJECTED", "WITHDRAWN"],
  INTERVIEWING: ["OFFERED", "REJECTED", "WITHDRAWN"],
  OFFERED: ["HIRED", "REJECTED", "WITHDRAWN"],
  HIRED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

export async function updateApplicationStatus(
  applicationId: string,
  recruiterProfileId: string,
  actorUserId: string,
  input: UpdateApplicationStatusInput,
) {
  const application = await getOwnedApplicationOrThrow(
    applicationId,
    recruiterProfileId,
  );

  const currentStatus = application.status as ApplicationStatus;
  const nextStatus = input.status as ApplicationStatus;

  const allowed = VALID_TRANSITIONS[currentStatus] ?? [];

  if (!allowed.includes(nextStatus)) {
    throw new ApiError(
      `Cannot transition application from ${currentStatus} to ${nextStatus}`,
      409,
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedApp = await tx.application.update({
      where: { id: applicationId },
      data: { status: nextStatus },
    });

    await tx.applicationEvent.create({
      data: {
        applicationId,
        actorUserId,
        fromStatus: currentStatus,
        toStatus: nextStatus,
        note: input.note || null,
      },
    });

    return updatedApp;
  }, { timeout: 20000, maxWait: 10000 });

  return updated;
}

/**
 * GET /recruiters/me/applications/:applicationId/events
 * Return the full event history for an authorized application.
 */
export async function getApplicationEvents(
  applicationId: string,
  recruiterProfileId: string,
) {
  // Verify ownership
  await getOwnedApplicationOrThrow(applicationId, recruiterProfileId);

  const events = await prisma.applicationEvent.findMany({
    where: { applicationId },
    orderBy: { createdAt: "asc" },
    include: {
      actor: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  return events;
}
