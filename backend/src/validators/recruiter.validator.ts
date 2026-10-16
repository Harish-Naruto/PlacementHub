import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ---------------------------------------------------------------------------
// Company / Recruiter profile
// ---------------------------------------------------------------------------

export const upsertCompanySchema = z.object({
  // Company fields
  companyName: z
    .string()
    .min(1, "Company name is required")
    .max(200)
    .transform((s) => s.trim()),
  companySlug: z
    .string()
    .min(1, "Company slug is required")
    .max(220)
    .regex(SLUG_RE, "Slug must be lowercase alphanumeric with hyphens")
    .optional(),
  website: z.string().url("Invalid website URL").max(2048).optional().or(z.literal("")),
  description: z.string().max(5000).optional(),
  city: z.string().max(120).optional(),
  country: z.string().max(100).optional(),

  // Recruiter profile fields
  jobTitle: z.string().max(120).optional(),
});

export type UpsertCompanyInput = z.infer<typeof upsertCompanySchema>;

// ---------------------------------------------------------------------------
// Skill requirement item (used inside job create/update)
// ---------------------------------------------------------------------------

export const skillRequirementSchema = z.object({
  skillId: z.string().uuid("skillId must be a UUID"),
  requirementType: z.enum(["REQUIRED", "PREFERRED"]),
  weight: z.number().gt(0).max(100).default(1.0),
});

export type SkillRequirementInput = z.infer<typeof skillRequirementSchema>;

// ---------------------------------------------------------------------------
// Create / Update job
// ---------------------------------------------------------------------------

export const createJobSchema = z.object({
  title: z
    .string()
    .min(1, "Job title is required")
    .max(200)
    .transform((s) => s.trim()),
  description: z.string().min(1, "Description is required"),
  location: z.string().max(200).optional(),
  workMode: z.enum(["ONSITE", "HYBRID", "REMOTE"]).default("ONSITE"),
  employmentType: z
    .enum(["FULL_TIME", "INTERNSHIP", "CONTRACT", "PART_TIME"])
    .default("FULL_TIME"),
  minimumCgpa: z.number().min(0).max(10).optional().nullable(),
  applicationDeadline: z
    .string()
    .optional()
    .nullable()
    .refine(
      (val) => !val || val.trim() === "" || !isNaN(Date.parse(val)),
      { message: "Invalid date or datetime format" }
    )
    .transform((val) => {
      if (!val || val.trim() === "") return undefined;
      return new Date(val).toISOString();
    }),
  externalUrl: z.string().url("Invalid URL").max(2048).optional().nullable(),
  eligibleBranches: z.array(z.string().max(120)).optional().default([]),
  eligibleGraduationYears: z.array(z.number().int().min(2000).max(2100)).optional().default([]),
  skillRequirements: z.array(skillRequirementSchema).optional().default([]),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional().default("DRAFT"),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;

export const updateJobSchema = createJobSchema.partial();
export type UpdateJobInput = z.infer<typeof updateJobSchema>;

// ---------------------------------------------------------------------------
// Application status update
// ---------------------------------------------------------------------------

export const updateApplicationStatusSchema = z.object({
  status: z.enum([
    "APPLIED",
    "IN_REVIEW",
    "SHORTLISTED",
    "INTERVIEW_SCHEDULED",
    "INTERVIEWING",
    "OFFERED",
    "HIRED",
    "REJECTED",
    "WITHDRAWN",
  ]),
  note: z.string().max(1000).optional(),
});

export type UpdateApplicationStatusInput = z.infer<typeof updateApplicationStatusSchema>;

// ---------------------------------------------------------------------------
// Pagination / filtering query params
// ---------------------------------------------------------------------------

export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? Math.max(1, parseInt(v, 10)) : 1)),
  limit: z
    .string()
    .optional()
    .transform((v) => {
      const n = v ? parseInt(v, 10) : 20;
      return Math.min(Math.max(1, n), 100);
    }),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
