import { z } from "zod";

// Shared by the placement team and recruiter portals.

const optionalText = (max: number) =>
  z.preprocess((v) => (v === "" ? null : v), z.string().max(max).nullable()).optional();

const skillList = z.array(z.string().trim().min(1).max(120)).max(40);

export const jobPatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().min(1).max(20_000).optional(),
  location: optionalText(200),
  workMode: z.enum(["ONSITE", "HYBRID", "REMOTE"]).optional(),
  employmentType: z.enum(["FULL_TIME", "INTERNSHIP", "CONTRACT", "PART_TIME"]).optional(),
  minimumCgpa: z.preprocess((v) => (v === "" ? null : v), z.coerce.number().min(0).max(10).nullable()).optional(),
  applicationDeadline: z.preprocess((v) => (v === "" ? null : v), z.string().max(40).nullable()).optional(),
  externalUrl: z.preprocess((v) => (v === "" ? null : v), z.string().url().max(2048).nullable()).optional(),
  required: skillList.optional(),
  preferred: skillList.optional(),
  eligibleBranches: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  graduationYears: z.array(z.coerce.number().int().min(2020).max(2040)).max(10).optional(),
});
export type JobPatchInput = z.infer<typeof jobPatchSchema>;

export const statusChangeSchema = z.object({
  status: z.enum(["APPLIED", "IN_REVIEW", "SHORTLISTED", "INTERVIEW_SCHEDULED", "INTERVIEWING", "OFFERED", "HIRED", "REJECTED", "WITHDRAWN"]),
  note: z.string().trim().max(1000).optional(),
});

export const rankFilterSchema = z.object({
  institutionId: z.string().uuid().optional(),
  branch: z.string().trim().max(120).optional(),
  graduationYear: z.coerce.number().int().min(2020).max(2040).optional(),
  minCgpa: z.coerce.number().min(0).max(10).optional(),
});
export type RankFilterInput = z.infer<typeof rankFilterSchema>;

const stageEnum = z.enum(["Applied", "Interview", "Offer", "Closed"]);

export const boardQuerySchema = z.object({
  stage: stageEnum.optional(),
  jobId: z.string().uuid().optional(),
  institutionId: z.string().uuid().optional(),
});

// ---- placement ----------------------------------------------------------------------------------

export const ingestPasteSchema = z.object({
  text: z.string().trim().min(20, "Paste the full posting").max(30_000),
  sourceType: z.enum(["PARTNER_POSTING", "ALUMNI_REFERRAL", "OTHER"]).default("PARTNER_POSTING"),
  sourceLabel: z.string().trim().max(120).optional(),
  sourceUrl: z.string().url().max(2048).optional(),
  company: z.string().trim().max(200).optional(),
  title: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
});

export const ingestApiSchema = z.object({ adapter: z.enum(["remotive"]).default("remotive") });

export const rankRequestSchema = z
  .object({
    jobId: z.string().uuid().optional(),
    jobDescription: z.string().trim().min(20, "Paste the full job description").max(30_000).optional(),
    filter: rankFilterSchema.default({}),
    limit: z.coerce.number().int().min(1).max(500).default(100),
    includeIneligible: z.boolean().default(true),
  })
  .refine((v) => v.jobId || v.jobDescription, { message: "Provide a jobId or a jobDescription" });

// ---- recruiter ---------------------------------------------------------------------------------

export const recruiterProfileSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required").max(200),
  website: z.preprocess((v) => (v === "" ? null : v), z.string().url("Must be a valid URL").max(2048).nullable()).optional(),
  city: optionalText(120),
  country: optionalText(100),
  description: optionalText(3000),
  jobTitle: optionalText(120),
});

export const recruiterCreateJobSchema = jobPatchSchema.extend({
  /** A pasted description to parse. Explicit fields in the same request win over parsed ones. */
  jobDescription: z.string().trim().min(20).max(30_000).optional(),
});

export const applicantsQuerySchema = z.object({
  stage: stageEnum.optional(),
  minFit: z.coerce.number().int().min(0).max(100).optional(),
  eligibleOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});
