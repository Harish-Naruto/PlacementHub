// Placement team operations: review ingested openings, rank a whole batch against one job description,
// and see every application on one board.

import prisma from "../config/prisma.ts";
import { ApiError } from "../utils/apiError.ts";
import { JOB_INCLUDE, parsedJobToInput, parsePostingText } from "./ingest.service.ts";
import { loadJobInput, loadStudentsByFilter, rankStudents, type StudentFilter } from "./match.service.ts";
import { withCompany } from "./job.service.ts";
import { STAGES, stageOf, type Stage } from "../pipeline/transitions.ts";
import type { FitResult, JobInput } from "../matching/fit.ts";

// ---------------------------------------------------------------------------
// Openings
// ---------------------------------------------------------------------------

export async function listJobsForPlacement(opts: { status?: string; search?: string }) {
  const jobs = await prisma.jobPosting.findMany({
    where: {
      ...(opts.status ? { status: opts.status as never } : {}),
      ...(opts.search ? { OR: [{ title: { contains: opts.search, mode: "insensitive" } }, { company: { name: { contains: opts.search, mode: "insensitive" } } }] } : {}),
    },
    include: { ...JOB_INCLUDE, _count: { select: { applications: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return jobs.map(withCompany);
}

export async function getJobForPlacement(jobId: string) {
  const job = await prisma.jobPosting.findUnique({ where: { id: jobId }, include: { ...JOB_INCLUDE, _count: { select: { applications: true } } } });
  if (!job) throw new ApiError("Job not found", 404);
  return withCompany(job);
}

// ---------------------------------------------------------------------------
// Batch ranking
// ---------------------------------------------------------------------------

export interface RankRequest {
  jobId?: string;
  jobDescription?: string;
  filter: StudentFilter;
  limit: number;
  includeIneligible: boolean;
}

const rowOf = (r: ReturnType<typeof rankStudents>[number]) => {
  const f: FitResult = r.fit;
  return {
    rank: r.rank,
    studentProfileId: r.studentProfileId,
    name: r.name,
    email: r.email,
    institution: r.institution,
    branch: r.branch,
    cgpa: r.cgpa,
    graduationYear: r.graduationYear,
    githubUsername: r.githubUsername,
    fitScore: f.fitScore,
    band: f.band,
    eligible: f.eligibility.eligible,
    eligibilityFlags: f.eligibility.flags,
    eligibilityUnknown: f.eligibility.unknown,
    requiredDemonstrated: f.requiredDemonstrated,
    requiredTotal: f.requiredTotal,
    matched: f.matched.map((m) => ({ skill: m.skill, requirement: m.requirement, combinedScore: m.combinedScore })),
    gaps: f.gaps.map((g) => ({ skill: g.skill, requirement: g.requirement, kind: g.kind, detail: g.detail })),
    explanation: f.explanation,
    verifiedSkills: r.verifiedSkills,
    flaggedSkills: r.flaggedSkills,
  };
};

interface RankedJobSummary {
  jobId: string | null;
  title: string;
  company: string | null;
  required: string[];
  preferred: string[];
  parseMethod: string | null;
  minCgpa: number | null;
  eligibleBranches: string[];
  graduationYears: number[];
}

export async function rankBatch(req: RankRequest) {
  let input: JobInput;
  let summary: RankedJobSummary;

  if (req.jobId) {
    const { job, input: jobInput } = await loadJobInput(req.jobId);
    const full = await getJobForPlacement(job.id);
    input = jobInput;
    summary = {
      jobId: job.id,
      title: job.title,
      company: full.company?.name ?? null,
      required: job.skillRequirements.filter((r) => r.requirementType === "REQUIRED").map((r) => r.skill.name),
      preferred: job.skillRequirements.filter((r) => r.requirementType === "PREFERRED").map((r) => r.skill.name),
      parseMethod: job.parseMethod,
      minCgpa: jobInput.minCgpa,
      eligibleBranches: jobInput.eligibleBranches,
      graduationYears: jobInput.graduationYears,
    };
  } else {
    // The pasted description is parsed on the spot and never saved.
    const parsed = await parsePostingText(req.jobDescription!);
    if (parsed.required.length + parsed.preferred.length === 0) {
      throw new ApiError("No known skills were found in that description, so students cannot be ranked. Check that it lists the skills required.", 422, true, "NO_SKILLS_FOUND");
    }
    input = parsedJobToInput(parsed);
    summary = {
      jobId: null,
      title: parsed.title,
      company: parsed.company,
      required: parsed.required,
      preferred: parsed.preferred,
      parseMethod: parsed.parseMethod,
      minCgpa: parsed.minCgpa,
      eligibleBranches: parsed.eligibleBranches,
      graduationYears: parsed.graduationYears,
    };
  }

  const students = await loadStudentsByFilter(req.filter);
  const ranked = rankStudents(students, input, { includeIneligible: req.includeIneligible, limit: req.limit });
  return { job: summary, totalStudents: students.length, returned: ranked.length, rows: ranked.map(rowOf) };
}

// ---------------------------------------------------------------------------
// Students and dashboard
// ---------------------------------------------------------------------------

export async function listStudentsForPlacement(filter: StudentFilter) {
  const students = await loadStudentsByFilter(filter);
  const counts = await prisma.application.groupBy({
    by: ["studentProfileId", "status"],
    where: { studentProfileId: { in: students.map((s) => s.profileId) } },
    _count: true,
  });
  const byStudent = new Map<string, { applications: number; interviewing: number; offers: number }>();
  for (const c of counts) {
    const s = byStudent.get(c.studentProfileId) ?? { applications: 0, interviewing: 0, offers: 0 };
    s.applications += c._count;
    if (STAGES.Interview.includes(c.status)) s.interviewing += c._count;
    if (STAGES.Offer.includes(c.status)) s.offers += c._count;
    byStudent.set(c.studentProfileId, s);
  }
  return students
    .map((s) => ({
      studentProfileId: s.profileId,
      name: s.name,
      email: s.email,
      institution: s.institution,
      branch: s.branch,
      cgpa: s.cgpa,
      graduationYear: s.graduationYear,
      githubUsername: s.githubUsername,
      skills: s.input.skills.length,
      verifiedSkills: s.verifiedSkills,
      flaggedSkills: s.flaggedSkills,
      ...(byStudent.get(s.profileId) ?? { applications: 0, interviewing: 0, offers: 0 }),
    }))
    .sort((a, b) => b.verifiedSkills - a.verifiedSkills || a.name.localeCompare(b.name));
}

export async function placementStats() {
  const [jobsByStatus, jobsByOrigin, appsByStatus, students, merged] = await Promise.all([
    prisma.jobPosting.groupBy({ by: ["status"], _count: true }),
    prisma.jobPosting.groupBy({ by: ["origin"], _count: true }),
    prisma.application.groupBy({ by: ["status"], _count: true }),
    prisma.studentProfile.count({ where: { user: { role: "STUDENT" } } }),
    prisma.jobPosting.count({ where: { sourceCount: { gt: 1 } } }),
  ]);
  const stages: Record<Stage, number> = { Applied: 0, Interview: 0, Offer: 0, Closed: 0 };
  for (const a of appsByStatus) stages[stageOf(a.status)] += a._count;
  return {
    students,
    jobs: Object.fromEntries(jobsByStatus.map((j) => [j.status, j._count])),
    jobsBySource: Object.fromEntries(jobsByOrigin.map((j) => [j.origin, j._count])),
    jobsSeenInMultipleSources: merged,
    applicationsByStage: stages,
  };
}
