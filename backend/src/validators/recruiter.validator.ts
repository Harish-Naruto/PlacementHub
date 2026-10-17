import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const WorkModeEnum = z.enum(["ONSITE", "HYBRID", "REMOTE"]);
export const EmploymentTypeEnum = z.enum([
  "FULL_TIME",
  "INTERNSHIP",
  "CONTRACT",
  "PART_TIME",
]);
export const JobStatusEnum = z.enum(["DRAFT", "PUBLISHED", "PAUSED", "CLOSED"]);
export const JobRequirementTypeEnum = z.enum(["REQUIRED", "PREFERRED"]);

export const ApplicationStatusEnum = z.enum([
  "APPLIED",
  "IN_REVIEW",
  "SHORTLISTED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEWING",
  "OFFERED",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
]);

// ---------------------------------------------------------------------------
// Upsert Company / Profile Schema
// ---------------------------------------------------------------------------

export const upsertCompanySchema = z.object({
  jobTitle: z.string().max(120).optional().nullable(),
  companyName: z.string().min(1, "Company name is required").max(200).optional(),
  name: z.string().min(1).max(200).optional(),
  website: z.string().max(2048).optional().nullable(),
  description: z.string().max(3000).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  company: z
    .object({
      name: z.string().min(1, "Company name is required").max(200),
      website: z.string().max(2048).optional().nullable(),
      description: z.string().max(3000).optional().nullable(),
      city: z.string().max(120).optional().nullable(),
      country: z.string().max(100).optional().nullable(),
    })
    .optional(),
});

export type UpsertCompanyInput = z.infer<typeof upsertCompanySchema>;

// ---------------------------------------------------------------------------
// Skill Requirement Item
// ---------------------------------------------------------------------------

export const skillRequirementItemSchema = z.object({
  skillId: z.string().uuid().optional(),
  skillName: z.string().min(1).max(120).optional(),
  requirementType: JobRequirementTypeEnum.default("REQUIRED"),
  weight: z.number().min(0.1).max(10).default(1.0),
});

// ---------------------------------------------------------------------------
// Create Job Schema
// ---------------------------------------------------------------------------

export const createJobSchema = z.object({
  title: z.string().min(1, "Job title is required").max(200),
  description: z.string().min(1, "Job description is required"),
  location: z.string().max(200).optional().nullable(),
  workMode: WorkModeEnum.default("ONSITE"),
  employmentType: EmploymentTypeEnum.default("FULL_TIME"),
  minimumCgpa: z.number().min(0).max(10).optional().nullable(),
  applicationDeadline: z.string().or(z.date()).optional().nullable(),
  externalUrl: z.string().max(2048).optional().nullable(),
  status: JobStatusEnum.optional().default("DRAFT"),
  eligibleBranches: z.array(z.string().min(1).max(120)).optional().default([]),
  graduationYears: z.array(z.number().int()).optional().default([]),
  skillRequirements: z.array(skillRequirementItemSchema).optional().default([]),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;

// ---------------------------------------------------------------------------
// Update Job Schema
// ---------------------------------------------------------------------------

export const updateJobSchema = createJobSchema.partial();
export type UpdateJobInput = z.infer<typeof updateJobSchema>;

// ---------------------------------------------------------------------------
// Update Application Status Schema
// ---------------------------------------------------------------------------

export const updateApplicationStatusSchema = z.object({
  status: ApplicationStatusEnum,
  note: z.string().max(1000).optional().nullable(),
});

export type UpdateApplicationStatusInput = z.infer<
  typeof updateApplicationStatusSchema
>;

// ---------------------------------------------------------------------------
// Pagination Schema
// ---------------------------------------------------------------------------

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;
