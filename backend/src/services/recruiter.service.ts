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
  WorkMode,
  EmploymentType,
  JobRequirementType,
} from "../../generated/prisma/client.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// 1. Get Recruiter Profile
// ---------------------------------------------------------------------------

export async function getProfile(userId: string) {
  const profile = await prisma.recruiterProfile.findUnique({
    where: { userId },
    include: {
      company: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          profileImage: true,
          createdAt: true,
        },
      },
      _count: {
        select: { jobs: true },
      },
    },
  });

  return profile;
}

// ---------------------------------------------------------------------------
// 2. Get or Auto-Create Recruiter Profile
// ---------------------------------------------------------------------------

export async function getRecruiterProfileOrThrow(userId: string) {
  let profile = await prisma.recruiterProfile.findUnique({
    where: { userId },
    include: { company: true },
  });

  if (!profile) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new ApiError("User not found", 404);
    }

    const orgName = user.name ? `${user.name}'s Organization` : "Corporate Partner";
    const slug = `${slugify(orgName)}-${userId.slice(0, 6)}`;

    // Create default company
    const company = await prisma.company.create({
      data: {
        name: orgName,
        slug,
        createdById: userId,
      },
    });

    profile = await prisma.recruiterProfile.create({
      data: {
        userId,
        companyId: company.id,
        jobTitle: "Talent Acquisition Specialist",
      },
      include: { company: true },
    });
  }

  return profile;
}

// ---------------------------------------------------------------------------
// 3. Upsert Recruiter & Company Profile
// ---------------------------------------------------------------------------

export async function upsertProfile(userId: string, data: UpsertCompanyInput) {
  const companyName =
    data.company?.name || data.companyName || data.name || "Enterprise Partner";
  const website = data.company?.website ?? data.website ?? null;
  const description = data.company?.description ?? data.description ?? null;
  const city = data.company?.city ?? data.city ?? null;
  const country = data.company?.country ?? data.country ?? "India";
  const jobTitle = data.jobTitle ?? undefined;

  const existing = await prisma.recruiterProfile.findUnique({
    where: { userId },
    include: { company: true },
  });

  if (existing) {
    // Update company and recruiter
    const updatedCompany = await prisma.company.update({
      where: { id: existing.companyId },
      data: {
        name: companyName,
        website: website || undefined,
        description: description || undefined,
        city: city || undefined,
        country: country || undefined,
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

  // Create new company and profile
  const slug = `${slugify(companyName)}-${userId.slice(0, 6)}`;
  const company = await prisma.company.create({
    data: {
      name: companyName,
      slug,
      website: website || null,
      description: description || null,
      city: city || null,
      country: country || "India",
      createdById: userId,
    },
  });

  const profile = await prisma.recruiterProfile.create({
    data: {
      userId,
      companyId: company.id,
      jobTitle: jobTitle || "Talent Acquisition Manager",
    },
    include: { company: true },
  });

  return { profile, company };
}

// ---------------------------------------------------------------------------
// 4. List Recruiter's Jobs
// ---------------------------------------------------------------------------

export async function listJobs(
  recruiterProfileId: string,
  page = 1,
  limit = 10,
  status?: JobStatus,
) {
  const skip = (page - 1) * limit;

  const where: any = {
    recruiterProfileId,
    ...(status ? { status } : {}),
  };

  const [jobs, total] = await Promise.all([
    prisma.jobPosting.findMany({
      where,
      include: {
        recruiterProfile: {
          include: { company: true },
        },
        skillRequirements: {
          include: { skill: true },
        },
        eligibleBranches: true,
        graduationYears: true,
        _count: {
          select: { applications: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.jobPosting.count({ where }),
  ]);

  return {
    jobs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

// ---------------------------------------------------------------------------
// 5. Create Job Posting
// ---------------------------------------------------------------------------

export async function createJob(
  recruiterProfileId: string,
  data: CreateJobInput,
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
    status = "DRAFT",
    eligibleBranches = [],
    graduationYears = [],
    skillRequirements = [],
  } = data;

  // Resolve skill requirements: create skills if they don't exist yet
  const resolvedSkills: Array<{
    skillId: string;
    requirementType: JobRequirementType;
    weight: number;
  }> = [];

  for (const sr of skillRequirements) {
    let skillId = sr.skillId;
    if (!skillId && sr.skillName) {
      const cleanName = sr.skillName.trim();
      let skill = await prisma.skill.findFirst({
        where: { name: { equals: cleanName, mode: "insensitive" } },
      });
      if (!skill) {
        skill = await prisma.skill.create({ data: { name: cleanName } });
      }
      skillId = skill.id;
    }

    if (skillId) {
      resolvedSkills.push({
        skillId,
        requirementType: (sr.requirementType as JobRequirementType) || "REQUIRED",
        weight: sr.weight || 1.0,
      });
    }
  }

  const deadline = applicationDeadline ? new Date(applicationDeadline) : null;

  const job = await prisma.jobPosting.create({
    data: {
      recruiterProfileId,
      title,
      description,
      location: location || null,
      workMode: (workMode as WorkMode) || "ONSITE",
      employmentType: (employmentType as EmploymentType) || "FULL_TIME",
      minimumCgpa: minimumCgpa ? Number(minimumCgpa) : null,
      applicationDeadline: deadline,
      externalUrl: externalUrl || null,
      status: (status as JobStatus) || "DRAFT",
      eligibleBranches: {
        create: eligibleBranches.map((b) => ({ branch: b.trim() })),
      },
      graduationYears: {
        create: graduationYears.map((y) => ({ graduationYear: Number(y) })),
      },
      skillRequirements: {
        create: resolvedSkills.map((rs) => ({
          skillId: rs.skillId,
          requirementType: rs.requirementType,
          weight: rs.weight,
        })),
      },
    },
    include: {
      recruiterProfile: { include: { company: true } },
      skillRequirements: { include: { skill: true } },
      eligibleBranches: true,
      graduationYears: true,
      _count: { select: { applications: true } },
    },
  });

  return job;
}

// ---------------------------------------------------------------------------
// 6. Get Single Job
// ---------------------------------------------------------------------------

export async function getJob(jobId: string, recruiterProfileId: string) {
  const job = await prisma.jobPosting.findFirst({
    where: {
      id: jobId,
      recruiterProfileId,
    },
    include: {
      recruiterProfile: { include: { company: true } },
      skillRequirements: { include: { skill: true } },
      eligibleBranches: true,
      graduationYears: true,
      _count: { select: { applications: true } },
    },
  });

  if (!job) {
    throw new ApiError("Job not found or does not belong to your company", 404);
  }

  return job;
}

// ---------------------------------------------------------------------------
// 7. Update Job
// ---------------------------------------------------------------------------

export async function updateJob(
  jobId: string,
  recruiterProfileId: string,
  data: UpdateJobInput,
) {
  // Verify ownership
  await getJob(jobId, recruiterProfileId);

  const {
    title,
    description,
    location,
    workMode,
    employmentType,
    minimumCgpa,
    applicationDeadline,
    externalUrl,
    status,
    eligibleBranches,
    graduationYears,
    skillRequirements,
  } = data;

  return prisma.$transaction(async (tx) => {
    // 1. Update branches if provided
    if (eligibleBranches !== undefined) {
      await tx.jobEligibleBranch.deleteMany({ where: { jobPostingId: jobId } });
      if (eligibleBranches.length > 0) {
        await tx.jobEligibleBranch.createMany({
          data: eligibleBranches.map((b) => ({
            jobPostingId: jobId,
            branch: b.trim(),
          })),
        });
      }
    }

    // 2. Update grad years if provided
    if (graduationYears !== undefined) {
      await tx.jobEligibleGraduationYear.deleteMany({
        where: { jobPostingId: jobId },
      });
      if (graduationYears.length > 0) {
        await tx.jobEligibleGraduationYear.createMany({
          data: graduationYears.map((y) => ({
            jobPostingId: jobId,
            graduationYear: Number(y),
          })),
        });
      }
    }

    // 3. Update skill requirements if provided
    if (skillRequirements !== undefined) {
      await tx.jobSkillRequirement.deleteMany({
        where: { jobPostingId: jobId },
      });

      for (const sr of skillRequirements) {
        let skillId = sr.skillId;
        if (!skillId && sr.skillName) {
          const clean = sr.skillName.trim();
          let skill = await tx.skill.findFirst({
            where: { name: { equals: clean, mode: "insensitive" } },
          });
          if (!skill) {
            skill = await tx.skill.create({ data: { name: clean } });
          }
          skillId = skill.id;
        }

        if (skillId) {
          await tx.jobSkillRequirement.create({
            data: {
              jobPostingId: jobId,
              skillId,
              requirementType: (sr.requirementType as JobRequirementType) || "REQUIRED",
              weight: sr.weight || 1.0,
            },
          });
        }
      }
    }

    // 4. Update scalars
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (location !== undefined) updateData.location = location;
    if (workMode !== undefined) updateData.workMode = workMode as WorkMode;
    if (employmentType !== undefined)
      updateData.employmentType = employmentType as EmploymentType;
    if (minimumCgpa !== undefined)
      updateData.minimumCgpa = minimumCgpa !== null ? Number(minimumCgpa) : null;
    if (applicationDeadline !== undefined)
      updateData.applicationDeadline = applicationDeadline
        ? new Date(applicationDeadline)
        : null;
    if (externalUrl !== undefined) updateData.externalUrl = externalUrl;
    if (status !== undefined) updateData.status = status as JobStatus;

    return tx.jobPosting.update({
      where: { id: jobId },
      data: updateData,
      include: {
        recruiterProfile: { include: { company: true } },
        skillRequirements: { include: { skill: true } },
        eligibleBranches: true,
        graduationYears: true,
        _count: { select: { applications: true } },
      },
    });
  });
}

// ---------------------------------------------------------------------------
// 8. Publish / Pause / Close Quick Actions
// ---------------------------------------------------------------------------

export async function publishJob(jobId: string, recruiterProfileId: string) {
  await getJob(jobId, recruiterProfileId);
  return prisma.jobPosting.update({
    where: { id: jobId },
    data: { status: "PUBLISHED" },
    include: { recruiterProfile: { include: { company: true } } },
  });
}

export async function pauseJob(jobId: string, recruiterProfileId: string) {
  await getJob(jobId, recruiterProfileId);
  return prisma.jobPosting.update({
    where: { id: jobId },
    data: { status: "PAUSED" },
    include: { recruiterProfile: { include: { company: true } } },
  });
}

export async function closeJob(jobId: string, recruiterProfileId: string) {
  await getJob(jobId, recruiterProfileId);
  return prisma.jobPosting.update({
    where: { id: jobId },
    data: { status: "CLOSED" },
    include: { recruiterProfile: { include: { company: true } } },
  });
}

// ---------------------------------------------------------------------------
// 9. List Applications for a Job
// ---------------------------------------------------------------------------

export async function listJobApplications(
  jobId: string,
  recruiterProfileId: string,
  page = 1,
  limit = 10,
  status?: ApplicationStatus,
) {
  const job = await getJob(jobId, recruiterProfileId);
  const skip = (page - 1) * limit;

  const where: any = {
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
              select: {
                id: true,
                name: true,
                email: true,
                profileImage: true,
              },
            },
            institution: true,
            skills: {
              include: { skill: true },
            },
          },
        },
        events: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { appliedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.application.count({ where }),
  ]);

  return {
    job: {
      id: job.id,
      title: job.title,
      status: job.status,
    },
    applications,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

// ---------------------------------------------------------------------------
// 10. Get Single Application Details
// ---------------------------------------------------------------------------

export async function getApplication(
  applicationId: string,
  recruiterProfileId: string,
) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      jobPosting: {
        include: {
          recruiterProfile: { include: { company: true } },
          skillRequirements: { include: { skill: true } },
        },
      },
      studentProfile: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              profileImage: true,
            },
          },
          institution: true,
          skills: {
            include: { skill: true, evidence: true },
          },
          projects: {
            include: {
              skills: { include: { skill: true } },
            },
          },
        },
      },
      events: {
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!application) {
    throw new ApiError("Application not found", 404);
  }

  if (application.jobPosting.recruiterProfileId !== recruiterProfileId) {
    throw new ApiError(
      "Unauthorized: You cannot access applications for jobs posted by another recruiter",
      403,
    );
  }

  return application;
}

// ---------------------------------------------------------------------------
// 11. Update Application Status & Log Event
// ---------------------------------------------------------------------------

export async function updateApplicationStatus(
  applicationId: string,
  recruiterProfileId: string,
  actorUserId: string,
  data: UpdateApplicationStatusInput,
) {
  const application = await getApplication(applicationId, recruiterProfileId);

  const { status: toStatus, note } = data;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.application.update({
      where: { id: applicationId },
      data: { status: toStatus },
      include: {
        studentProfile: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    await tx.applicationEvent.create({
      data: {
        applicationId,
        actorUserId,
        fromStatus: application.status,
        toStatus,
        note: note || `Application status changed to ${toStatus} by recruiter`,
      },
    });

    return updated;
  });
}

// ---------------------------------------------------------------------------
// 12. Get Application Events History
// ---------------------------------------------------------------------------

export async function getApplicationEvents(
  applicationId: string,
  recruiterProfileId: string,
) {
  await getApplication(applicationId, recruiterProfileId);

  return prisma.applicationEvent.findMany({
    where: { applicationId },
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}
