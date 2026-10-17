// Loads a student's evidence and the opening, then runs the pure resume builder and claim checker.

import prisma from "../config/prisma.ts";
import { ApiError } from "../utils/apiError.ts";
import { canonicalOrSelf } from "../skills/canonical.ts";
import type { ParsedResume } from "../resume/schema.ts";
import {
  buildResume,
  renderResumeHtml,
  type BuilderExperience,
  type BuilderProject,
  type BuilderSkill,
  type GeneratedResume,
} from "../resumeBuilder/build.ts";
import { checkResumeClaims, type ClaimCheckResult } from "../resumeBuilder/claimCheck.ts";
import { computeFit, type FitResult } from "../matching/fit.ts";
import { jobToInput, loadStudentByUser, type LoadedStudent } from "./match.service.ts";

const toBuilderSkills = (s: LoadedStudent): BuilderSkill[] =>
  s.input.skills.map((k) => ({ skill: k.skill, status: k.status, combinedScore: k.combinedScore, assessmentScore: k.assessmentScore, githubScore: k.githubScore, evidenceUrls: k.evidenceUrls ?? [] }));

async function requireStudent(userId: string): Promise<LoadedStudent> {
  const student = await loadStudentByUser(userId);
  if (!student) throw new ApiError("Complete your student profile first", 409, true, "PROFILE_REQUIRED");
  return student;
}

async function latestParsedResume(userId: string, resumeId?: string): Promise<ParsedResume | null> {
  const row = resumeId
    ? await prisma.parsedResume.findFirst({ where: { id: resumeId, userId } })
    : await prisma.parsedResume.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  return (row?.data as ParsedResume | undefined) ?? null;
}

/** Portfolio projects and resume projects describe the same work: merge them by title. */
function mergeProjects(
  stored: { id: string; title: string; description: string; personalContribution: string | null; repositoryUrl: string | null; skills: { skill: { name: string } }[] }[],
  parsed: ParsedResume | null,
): BuilderProject[] {
  const byTitle = new Map<string, BuilderProject>();
  const key = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "");
  for (const p of stored) {
    byTitle.set(key(p.title), {
      id: p.id,
      title: p.title,
      description: p.description,
      role: p.personalContribution,
      technologies: p.skills.map((s) => s.skill.name),
      features: [],
      repositoryUrl: p.repositoryUrl,
    });
  }
  for (const p of parsed?.projects ?? []) {
    const k = key(p.name);
    const prev = byTitle.get(k);
    const features = p.features.map((f) => f.claim).filter(Boolean);
    if (prev) {
      prev.technologies = [...new Set([...prev.technologies, ...p.technologies].map(canonicalOrSelf))];
      prev.features = features;
      prev.role = prev.role ?? p.role;
      prev.repositoryUrl = prev.repositoryUrl ?? p.repository_urls[0] ?? null;
    } else {
      byTitle.set(k, { id: `resume-${k}`, title: p.name, description: p.description, role: p.role, technologies: p.technologies, features, repositoryUrl: p.repository_urls[0] ?? null });
    }
  }
  return [...byTitle.values()];
}

const experienceOf = (parsed: ParsedResume | null): BuilderExperience[] =>
  (parsed?.experience ?? []).map((x) => ({ organization: x.organization, title: x.title, startDate: x.start_date, endDate: x.end_date, isCurrent: x.is_current, responsibilities: x.responsibilities }));

export interface ResumeForJob {
  resume: GeneratedResume;
  html: string;
  fit: FitResult;
  jobId: string;
}

export async function generateResumeForJob(userId: string, jobId: string, resumeId?: string): Promise<ResumeForJob> {
  const student = await requireStudent(userId);
  const job = await prisma.jobPosting.findUnique({
    where: { id: jobId },
    include: { company: true, recruiterProfile: { include: { company: true } }, skillRequirements: { include: { skill: true } }, eligibleBranches: true, graduationYears: true },
  });
  if (!job) throw new ApiError("Job not found", 404);

  const [stored, parsed] = await Promise.all([
    prisma.project.findMany({ where: { studentProfileId: student.profileId }, include: { skills: { include: { skill: { select: { name: true } } } } } }),
    latestParsedResume(userId, resumeId),
  ]);

  const resume = buildResume({
    profile: {
      name: student.name,
      email: student.email,
      githubUsername: student.githubUsername,
      linkedinUrl: student.linkedinUrl,
      institution: student.institution,
      degree: student.degree,
      branch: student.branch,
      graduationYear: student.graduationYear,
      cgpa: student.cgpa,
    },
    skills: toBuilderSkills(student),
    projects: mergeProjects(stored, parsed),
    experience: experienceOf(parsed),
    job: {
      title: job.title,
      company: (job.company ?? job.recruiterProfile?.company)?.name ?? null,
      requirements: job.skillRequirements.map((r) => ({ skill: r.skill.name, type: r.requirementType, weight: Number(r.weight) })),
    },
  });
  return { resume, html: renderResumeHtml(resume), fit: computeFit(student.input, jobToInput(job)), jobId };
}

export interface ClaimCheckResponse extends ClaimCheckResult {
  resumeId: string;
  checkedAt: string;
}

export async function claimCheckForResume(userId: string, resumeId: string): Promise<ClaimCheckResponse> {
  const row = await prisma.parsedResume.findFirst({ where: { id: resumeId, userId } });
  if (!row) throw new ApiError("Resume not found", 404);
  const student = await loadStudentByUser(userId);
  const result = checkResumeClaims(row.data as unknown as ParsedResume, student ? toBuilderSkills(student) : []);
  return { resumeId, checkedAt: new Date().toISOString(), ...result };
}

/** Claim summary for the resume a student last uploaded, used on application views. */
export async function latestClaimSummary(userId: string): Promise<ClaimCheckResult["summary"] | null> {
  const row = await prisma.parsedResume.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { id: true } });
  if (!row) return null;
  return (await claimCheckForResume(userId, row.id)).summary;
}
