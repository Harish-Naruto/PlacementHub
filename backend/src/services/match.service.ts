// Loads students and openings from the database and runs the pure fit scorer (matching/fit.ts).
// Batch work loads every student in one query and scores in memory: no per-student queries.

import prisma from "../config/prisma.ts";
import { ApiError } from "../utils/apiError.ts";
import { computeFit, type FitResult, type JobInput, type StudentInput, type StudentSkillInput } from "../matching/fit.ts";
import { rankCandidates } from "../matching/rank.ts";

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

const STUDENT_INCLUDE = {
  user: { select: { name: true, email: true } },
  institution: { select: { name: true } },
  skills: {
    include: {
      skill: { select: { name: true } },
      evidence: { where: { sourceType: "GITHUB_REPOSITORY" as const }, select: { sourceUrl: true } },
    },
  },
};

type LoadedProfile = Awaited<ReturnType<typeof prisma.studentProfile.findMany<{ include: typeof STUDENT_INCLUDE }>>>[number];

export interface LoadedStudent {
  profileId: string;
  userId: string;
  name: string;
  email: string;
  institution: string | null;
  branch: string | null;
  degree: string | null;
  cgpa: number | null;
  graduationYear: number | null;
  githubUsername: string | null;
  linkedinUrl: string | null;
  input: StudentInput;
  verifiedSkills: number;
  flaggedSkills: number;
}

function toLoaded(p: LoadedProfile): LoadedStudent {
  const skills: StudentSkillInput[] = p.skills.map((s) => ({
    skill: s.skill.name,
    combinedScore: s.combinedScore,
    assessmentScore: s.assessmentScore,
    githubScore: s.githubScore,
    status: s.verificationStatus,
    evidenceUrls: s.evidence.map((e) => e.sourceUrl).filter((u): u is string => !!u),
  }));
  const cgpa = p.cgpa === null ? null : Number(p.cgpa);
  return {
    profileId: p.id,
    userId: p.userId,
    name: p.user.name ?? p.user.email,
    email: p.user.email,
    institution: p.institution?.name ?? null,
    branch: p.branch,
    degree: p.degree,
    cgpa,
    graduationYear: p.graduationYear,
    githubUsername: p.githubUsername,
    linkedinUrl: p.linkedinUrl,
    input: { cgpa, branch: p.branch, graduationYear: p.graduationYear, skills },
    verifiedSkills: p.skills.filter((s) => s.verificationStatus === "EVALUATED" || s.verificationStatus === "REPOSITORY_OBSERVED").length,
    flaggedSkills: p.skills.filter((s) => s.verificationStatus === "NEEDS_REVIEW").length,
  };
}

export async function loadStudentByUser(userId: string): Promise<LoadedStudent | null> {
  const p = await prisma.studentProfile.findUnique({ where: { userId }, include: STUDENT_INCLUDE });
  return p ? toLoaded(p) : null;
}

export async function loadStudentsByProfileIds(ids: string[]): Promise<LoadedStudent[]> {
  if (!ids.length) return [];
  return (await prisma.studentProfile.findMany({ where: { id: { in: ids } }, include: STUDENT_INCLUDE })).map(toLoaded);
}

export interface StudentFilter {
  institutionId?: string;
  branch?: string;
  graduationYear?: number;
  minCgpa?: number;
}

export async function loadStudentsByFilter(filter: StudentFilter): Promise<LoadedStudent[]> {
  const profiles = await prisma.studentProfile.findMany({
    where: {
      user: { role: "STUDENT" },
      ...(filter.institutionId ? { institutionId: filter.institutionId } : {}),
      ...(filter.graduationYear ? { graduationYear: filter.graduationYear } : {}),
      ...(filter.minCgpa !== undefined ? { cgpa: { gte: filter.minCgpa } } : {}),
    },
    include: STUDENT_INCLUDE,
  });
  const students = profiles.map(toLoaded);
  // Branch spellings differ ("CSE", "Computer Science"), so compare by key in memory.
  if (!filter.branch) return students;
  const { branchKey } = await import("../matching/branches.ts");
  const want = branchKey(filter.branch) ?? filter.branch.toLowerCase();
  return students.filter((s) => (branchKey(s.branch) ?? s.branch?.toLowerCase()) === want);
}

type LoadedJob = NonNullable<Awaited<ReturnType<typeof findJob>>>;

function findJob(jobId: string) {
  return prisma.jobPosting.findUnique({
    where: { id: jobId },
    include: { skillRequirements: { include: { skill: true } }, eligibleBranches: true, graduationYears: true },
  });
}

export function jobToInput(job: Pick<LoadedJob, "skillRequirements" | "eligibleBranches" | "graduationYears" | "minimumCgpa" | "applicationDeadline">): JobInput {
  return {
    requirements: job.skillRequirements.map((r) => ({ skill: r.skill.name, type: r.requirementType, weight: Number(r.weight) })),
    minCgpa: job.minimumCgpa === null ? null : Number(job.minimumCgpa),
    eligibleBranches: job.eligibleBranches.map((b) => b.branch),
    graduationYears: job.graduationYears.map((g) => g.graduationYear),
    deadline: job.applicationDeadline,
  };
}

export async function loadJobInput(jobId: string) {
  const job = await findJob(jobId);
  if (!job) throw new ApiError("Job not found", 404);
  return { job, input: jobToInput(job) };
}

// ---------------------------------------------------------------------------
// Student-facing
// ---------------------------------------------------------------------------

const EMPTY_STUDENT: StudentInput = { cgpa: null, branch: null, graduationYear: null, skills: [] };

export async function fitForStudent(userId: string, jobId: string): Promise<FitResult> {
  const [student, { input }] = await Promise.all([loadStudentByUser(userId), loadJobInput(jobId)]);
  return computeFit(student?.input ?? EMPTY_STUDENT, input);
}

export interface FitBrief {
  fitScore: number | null;
  band: FitResult["band"];
  eligible: boolean;
  requiredDemonstrated: number;
  requiredTotal: number;
}

const brief = (f: FitResult): FitBrief => ({ fitScore: f.fitScore, band: f.band, eligible: f.eligibility.eligible, requiredDemonstrated: f.requiredDemonstrated, requiredTotal: f.requiredTotal });

/** Fit for many jobs at once; the student is loaded once. */
export async function fitBriefsForJobs(userId: string, jobs: (Parameters<typeof jobToInput>[0] & { id: string })[]): Promise<Map<string, FitBrief>> {
  const student = (await loadStudentByUser(userId))?.input ?? EMPTY_STUDENT;
  return new Map(jobs.map((j) => [j.id, brief(computeFit(student, jobToInput(j)))]));
}

export async function recommendationsFor(userId: string, limit = 10) {
  const student = (await loadStudentByUser(userId))?.input ?? EMPTY_STUDENT;
  const jobs = await prisma.jobPosting.findMany({
    where: { status: "PUBLISHED" },
    include: { company: true, recruiterProfile: { include: { company: true } }, skillRequirements: { include: { skill: true } }, eligibleBranches: true, graduationYears: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return jobs
    .map((job) => ({ job, fit: computeFit(student, jobToInput(job)) }))
    .filter((r) => r.fit.fitScore !== null)
    .sort((a, b) => Number(b.fit.eligibility.eligible) - Number(a.fit.eligibility.eligible) || (b.fit.fitScore ?? 0) - (a.fit.fitScore ?? 0))
    .slice(0, limit)
    .map(({ job, fit }) => ({ jobId: job.id, title: job.title, company: (job.company ?? job.recruiterProfile?.company)?.name ?? null, ...brief(fit), explanation: fit.explanation }));
}

// ---------------------------------------------------------------------------
// Ranking (placement team and recruiters)
// ---------------------------------------------------------------------------

export function toRankRow(s: LoadedStudent, fit: FitResult) {
  return {
    studentProfileId: s.profileId,
    name: s.name,
    email: s.email,
    institution: s.institution,
    branch: s.branch,
    cgpa: s.cgpa,
    graduationYear: s.graduationYear,
    githubUsername: s.githubUsername,
    fit,
    verifiedSkills: s.verifiedSkills,
    flaggedSkills: s.flaggedSkills,
  };
}

export function rankStudents(students: LoadedStudent[], job: JobInput, opts: { includeIneligible?: boolean; limit?: number } = {}) {
  const now = new Date();
  const rows = students.map((s) => toRankRow(s, computeFit(s.input, job, now)));
  return rankCandidates(rows, opts);
}
