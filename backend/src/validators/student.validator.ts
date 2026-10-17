import { z } from "zod";

// ---------------------------------------------------------------------------
// GitHub username regex
// ---------------------------------------------------------------------------
const githubUsernameRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

// ---------------------------------------------------------------------------
// Student profile update
// ---------------------------------------------------------------------------
export const updateProfileSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  institutionId: z
    .preprocess((v) => (v === "" ? null : v), z.string().uuid("Invalid institution ID").nullable())
    .optional(),
  branch: z
    .preprocess((v) => (v === "" ? null : v), z.string().max(120).nullable())
    .optional(),
  degree: z
    .preprocess((v) => (v === "" ? null : v), z.string().max(120).nullable())
    .optional(),
  graduationYear: z
    .preprocess((v) => (v === "" ? null : Number(v)), z.number().int().min(2020).max(2035).nullable())
    .optional(),
  cgpa: z
    .preprocess((v) => (v === "" ? null : Number(v)), z.number().min(0).max(10).nullable())
    .optional(),
  githubUsername: z
    .preprocess(
      (v) => (v === "" ? null : v),
      z.string().max(39).regex(githubUsernameRegex, "Invalid GitHub username format").nullable(),
    )
    .optional(),
  linkedinUrl: z
    .preprocess((v) => (v === "" ? null : v), z.string().url("Must be a valid URL").max(2048).nullable())
    .optional(),
  bio: z
    .preprocess((v) => (v === "" ? null : v), z.string().max(1000).nullable())
    .optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ---------------------------------------------------------------------------
// Add student skill
// ---------------------------------------------------------------------------
export const addSkillSchema = z.object({
  skillName: z.string().min(1).max(120).trim(),
  declaredLevel: z
    .enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"])
    .optional(),
});

export const updateSkillSchema = z.object({
  declaredLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]),
});

export type AddSkillInput = z.infer<typeof addSkillSchema>;
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>;

// ---------------------------------------------------------------------------
// Project create / update
// ---------------------------------------------------------------------------
export const createProjectSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().min(1).max(3000).trim(),
  personalContribution: z
    .preprocess((v) => (v === "" ? null : v), z.string().max(1000).nullable())
    .optional(),
  repositoryUrl: z
    .preprocess(
      (v) => (v === "" ? null : v),
      z.string().url("Must be a valid URL").max(2048).nullable(),
    )
    .optional(),
  demoUrl: z
    .preprocess(
      (v) => (v === "" ? null : v),
      z.string().url("Must be a valid URL").max(2048).nullable(),
    )
    .optional(),
  skillNames: z.array(z.string().min(1).max(120)).max(20).optional().default([]),
  status: z.enum(["DRAFT", "SUBMITTED"]).optional().default("DRAFT"),
});

export const updateProjectSchema = createProjectSchema.partial();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

// ---------------------------------------------------------------------------
// Job application
// ---------------------------------------------------------------------------
export const applyJobSchema = z.object({
  resumeUrl: z.string().url("Invalid resume URL").max(2048).optional(),
});

export type ApplyJobInput = z.infer<typeof applyJobSchema>;

// ---------------------------------------------------------------------------
// Job list query
// ---------------------------------------------------------------------------
export const jobListQuerySchema = z.object({
  search: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  workMode: z.enum(["ONSITE", "HYBRID", "REMOTE"]).optional(),
  employmentType: z
    .enum(["FULL_TIME", "INTERNSHIP", "CONTRACT", "PART_TIME"])
    .optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  // true adds the signed-in student's evidence-backed fit to every job card and sorts by it
  withFit: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export type JobListQuery = z.infer<typeof jobListQuerySchema>;
