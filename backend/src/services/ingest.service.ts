// Turns a job posting from any source into one JobPosting, merging openings that arrive more than once.
// Pure logic lives in jobs/parseJob.ts and jobs/dedupe.ts; this file only talks to the database.

import { createHash } from "node:crypto";
import prisma from "../config/prisma.ts";
import { ApiError } from "../utils/apiError.ts";
import { generateJSON } from "../assessment/gemini.ts";
import { parseJob, type JobHints, type JsonGenerator, type ParsedJob } from "../jobs/parseJob.ts";
import { dedupeKey, findDuplicate, normalizeCompany } from "../jobs/dedupe.ts";
import { fetchRemotive } from "../jobs/adapters/remotive.ts";
import type { RawJob } from "../jobs/types.ts";
import { resolveOrCreateSkill } from "./skill.service.ts";

export type IngestSourceType = "PARTNER_POSTING" | "ALUMNI_REFERRAL" | "JOB_API" | "RECRUITER_POSTED" | "OTHER";

export const JOB_INCLUDE = {
  company: true,
  recruiterProfile: { include: { company: true } },
  skillRequirements: { include: { skill: true } },
  eligibleBranches: true,
  graduationYears: true,
  sources: { orderBy: { importedAt: "asc" as const } },
};

/** Gemini when a key is configured (and not switched off), otherwise the rules parser alone. */
function llmGenerator(): JsonGenerator | undefined {
  if (!process.env.GEMINI_API_KEY || process.env.JOB_PARSE_LLM === "false") return undefined;
  return generateJSON;
}

const sha1 = (s: string) => createHash("sha1").update(s).digest("hex");
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 200) || "company";

// ---------------------------------------------------------------------------
// Company
// ---------------------------------------------------------------------------

/** Finds a company by normalised name ("ACME Pvt Ltd" = "Acme"), or creates it. */
export async function resolveCompany(name: string, createdById: string) {
  const wanted = normalizeCompany(name) || name.trim().toLowerCase();
  const companies = await prisma.company.findMany({ select: { id: true, name: true, slug: true } });
  const hit = companies.find((c) => (normalizeCompany(c.name) || c.name.trim().toLowerCase()) === wanted);
  if (hit) return hit;

  const taken = new Set(companies.map((c) => c.slug));
  const base = slugify(name);
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
  return prisma.company.create({ data: { name: name.trim().slice(0, 200), slug, createdById }, select: { id: true, name: true, slug: true } });
}

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

/** Required skills first-listed weigh a little more; a skill named in the title weighs most. */
export function requirementsOf(parsed: ParsedJob): { skill: string; type: "REQUIRED" | "PREFERRED"; weight: number }[] {
  const title = parsed.title.toLowerCase();
  const weightOf = (skill: string, index: number, count: number) => {
    if (title.includes(skill.toLowerCase())) return 1.2;
    return count > 1 ? Math.round((1 - (0.3 * index) / (count - 1)) * 100) / 100 : 1;
  };
  return [
    ...parsed.required.map((skill, i) => ({ skill, type: "REQUIRED" as const, weight: weightOf(skill, i, parsed.required.length) })),
    ...parsed.preferred.map((skill) => ({ skill, type: "PREFERRED" as const, weight: 1 })),
  ];
}

async function skillRows(reqs: { skill: string; type: "REQUIRED" | "PREFERRED"; weight: number }[]) {
  const rows = await Promise.all(
    reqs.map(async (r) => ({ skillId: (await resolveOrCreateSkill(r.skill)).id, requirementType: r.type, weight: r.weight })),
  );
  // Two names can resolve to the same skill row.
  const byId = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const prev = byId.get(r.skillId);
    if (!prev || r.requirementType === "REQUIRED") byId.set(r.skillId, r);
  }
  return [...byId.values()];
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export interface SourceInfo {
  sourceType: IngestSourceType;
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  externalId?: string | null;
}

const fingerprintOf = (source: SourceInfo, text: string) =>
  sha1(`${source.sourceType}|${source.externalId ?? sha1(text.toLowerCase().replace(/\s+/g, " ").trim())}`);

export async function createJobRecord(args: {
  parsed: ParsedJob;
  companyId: string;
  recruiterProfileId?: string | null;
  source: SourceInfo;
  status: "DRAFT" | "PUBLISHED";
}) {
  const { parsed, companyId, source } = args;
  const rows = await skillRows(requirementsOf(parsed));
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
  const deadline = parsed.deadline ? new Date(parsed.deadline) : null;

  return prisma.jobPosting.create({
    data: {
      title: parsed.title.slice(0, 200),
      description: parsed.description,
      location: parsed.location?.slice(0, 200) ?? null,
      workMode: parsed.workMode,
      employmentType: parsed.employmentType,
      minimumCgpa: parsed.minCgpa,
      applicationDeadline: deadline && !Number.isNaN(deadline.getTime()) ? deadline : null,
      externalUrl: source.sourceUrl ?? null,
      status: args.status,
      origin: source.sourceType,
      dedupeKey: dedupeKey({ company: company?.name ?? parsed.company, title: parsed.title, location: parsed.location }),
      parseMethod: parsed.parseMethod,
      sourceCount: 1,
      companyId,
      recruiterProfileId: args.recruiterProfileId ?? null,
      skillRequirements: { create: rows },
      eligibleBranches: { create: parsed.eligibleBranches.map((branch) => ({ branch })) },
      graduationYears: { create: parsed.graduationYears.map((graduationYear) => ({ graduationYear })) },
      sources: {
        create: [
          {
            sourceType: source.sourceType,
            sourceUrl: source.sourceUrl ?? null,
            externalId: source.externalId ?? null,
            sourceLabel: source.sourceLabel ?? null,
            fingerprint: fingerprintOf(source, parsed.description),
          },
        ],
      },
    },
    include: JOB_INCLUDE,
  });
}

// ---------------------------------------------------------------------------
// Ingest one posting
// ---------------------------------------------------------------------------

export interface IngestResult {
  jobId: string;
  created: boolean;
  /** How the opening was recognised as already known. */
  duplicate: null | { kind: "exact" | "fuzzy" | "same_source"; similarity: number };
  parseMethod: "llm" | "rules";
  skills: { required: string[]; preferred: string[] };
  sourceCount: number;
}

export interface IngestInput {
  text: string;
  source: SourceInfo;
  hints?: JobHints;
  userId: string;
}

export async function ingestJob(input: IngestInput): Promise<IngestResult> {
  const text = input.text.trim();
  if (text.length < 20) throw new ApiError("The posting text is too short to parse", 400);

  const parsed = await parseJob(text, { generate: llmGenerator(), hints: input.hints });
  const companyName = parsed.company?.trim();
  if (!companyName) {
    throw new ApiError("Could not find the company name in the posting. Add it as `company` in the request.", 422, true, "COMPANY_REQUIRED");
  }
  const company = await resolveCompany(companyName, input.userId);
  const skills = { required: parsed.required, preferred: parsed.preferred };

  // The same text (or API id) from the same kind of source is the same import: nothing to do.
  const fingerprint = fingerprintOf(input.source, text);
  const sameSource = await prisma.jobSource.findUnique({ where: { fingerprint }, select: { jobPostingId: true, jobPosting: { select: { sourceCount: true } } } });
  if (sameSource) {
    return { jobId: sameSource.jobPostingId, created: false, duplicate: { kind: "same_source", similarity: 100 }, parseMethod: parsed.parseMethod, skills, sourceCount: sameSource.jobPosting.sourceCount };
  }

  const existing = await prisma.jobPosting.findMany({
    where: { companyId: company.id },
    select: { id: true, title: true, location: true, dedupeKey: true, skillRequirements: { select: { skill: { select: { name: true } } } } },
  });
  const decision = findDuplicate(
    { company: company.name, title: parsed.title, location: parsed.location, skills: [...parsed.required, ...parsed.preferred] },
    existing.map((e) => ({ id: e.id, company: company.name, title: e.title, location: e.location, dedupeKey: e.dedupeKey, skills: e.skillRequirements.map((r) => r.skill.name) })),
  );

  if (decision.kind === "none") {
    const job = await createJobRecord({
      parsed,
      companyId: company.id,
      source: input.source,
      // A posting with no recognisable skills waits as a draft until someone fixes its skills.
      status: parsed.required.length + parsed.preferred.length > 0 ? "PUBLISHED" : "DRAFT",
    });
    return { jobId: job.id, created: true, duplicate: null, parseMethod: parsed.parseMethod, skills, sourceCount: 1 };
  }

  const merged = await mergeIntoJob(decision.jobId, parsed, input.source, fingerprint);
  return {
    jobId: decision.jobId,
    created: false,
    duplicate: { kind: decision.kind, similarity: decision.similarity },
    parseMethod: parsed.parseMethod,
    skills,
    sourceCount: merged.sourceCount,
  };
}

/** Adds the new source to an existing opening and unions the skills (required beats preferred). */
async function mergeIntoJob(jobId: string, parsed: ParsedJob, source: SourceInfo, fingerprint: string) {
  const job = await prisma.jobPosting.findUniqueOrThrow({
    where: { id: jobId },
    include: { skillRequirements: { include: { skill: true } } },
  });
  const rows = await skillRows(requirementsOf(parsed));
  const have = new Map(job.skillRequirements.map((r) => [r.skillId, r]));
  const deadline = parsed.deadline ? new Date(parsed.deadline) : null;

  // The same partner or alumnus re-sending an edited message is one source, not two.
  const knownSource = source.sourceLabel
    ? await prisma.jobSource.findFirst({ where: { jobPostingId: jobId, sourceType: source.sourceType, sourceLabel: source.sourceLabel }, select: { id: true } })
    : null;

  return prisma.$transaction(async (tx) => {
    if (!knownSource) {
      await tx.jobSource.create({
        data: { jobPostingId: jobId, sourceType: source.sourceType, sourceUrl: source.sourceUrl ?? null, externalId: source.externalId ?? null, sourceLabel: source.sourceLabel ?? null, fingerprint },
      });
    }
    for (const row of rows) {
      const prev = have.get(row.skillId);
      if (!prev) await tx.jobSkillRequirement.create({ data: { jobPostingId: jobId, ...row } });
      else if (row.requirementType === "REQUIRED" && prev.requirementType === "PREFERRED") {
        await tx.jobSkillRequirement.update({ where: { jobPostingId_skillId: { jobPostingId: jobId, skillId: row.skillId } }, data: { requirementType: "REQUIRED" } });
      }
    }
    return tx.jobPosting.update({
      where: { id: jobId },
      data: {
        ...(knownSource ? {} : { sourceCount: { increment: 1 } }),
        ...(parsed.description.length > job.description.length ? { description: parsed.description } : {}),
        ...(!job.minimumCgpa && parsed.minCgpa ? { minimumCgpa: parsed.minCgpa } : {}),
        ...(deadline && !Number.isNaN(deadline.getTime()) && (!job.applicationDeadline || deadline < job.applicationDeadline) ? { applicationDeadline: deadline } : {}),
        // A merged opening that was a draft only for lack of skills can now be published.
        ...(job.status === "DRAFT" && job.origin !== "RECRUITER_POSTED" && rows.length ? { status: "PUBLISHED" } : {}),
      },
      select: { sourceCount: true },
    });
  });
}

// ---------------------------------------------------------------------------
// Job API pull
// ---------------------------------------------------------------------------

export interface ApiIngestSummary {
  adapter: string;
  dataSource: "api" | "fixture";
  fetched: number;
  created: number;
  merged: number;
  skipped: number;
  results: (IngestResult & { title: string | null; company: string | null })[];
  errors: { externalId: string | null; message: string }[];
}

export async function ingestFromApi(adapter: string, userId: string): Promise<ApiIngestSummary> {
  if (adapter !== "remotive") throw new ApiError(`Unknown job API: ${adapter}`, 404);
  const { jobs, source } = await fetchRemotive(process.env.INGEST_USE_FIXTURES === "true");
  const summary: ApiIngestSummary = { adapter, dataSource: source, fetched: jobs.length, created: 0, merged: 0, skipped: 0, results: [], errors: [] };

  // Sequential on purpose: two postings of the same job in one batch must see each other for dedupe.
  for (const raw of jobs) {
    try {
      const text = rawToText(raw);
      const result = await ingestJob({
        text,
        userId,
        hints: { title: raw.title, company: raw.company, location: raw.location },
        source: { sourceType: "JOB_API", sourceLabel: "Remotive", sourceUrl: raw.applyUrl ?? null, externalId: raw.externalId ?? null },
      });
      summary.results.push({ ...result, title: raw.title ?? null, company: raw.company ?? null });
      if (result.created) summary.created++;
      else if (result.duplicate?.kind === "same_source") summary.skipped++;
      else summary.merged++;
    } catch (err) {
      summary.errors.push({ externalId: raw.externalId ?? null, message: err instanceof Error ? err.message : "failed" });
    }
  }
  return summary;
}

/** Parses posting text with the configured parser (Gemini when available, rules otherwise). Saves nothing. */
export const parsePostingText = (text: string, hints?: JobHints) => parseJob(text, { generate: llmGenerator(), hints });

/** The scorer input for a parsed posting, for ranking against text that was never saved. */
export function parsedJobToInput(parsed: ParsedJob) {
  const deadline = parsed.deadline ? new Date(parsed.deadline) : null;
  return {
    requirements: requirementsOf(parsed).map(({ skill, type, weight }) => ({ skill, type, weight })),
    minCgpa: parsed.minCgpa,
    eligibleBranches: parsed.eligibleBranches,
    graduationYears: parsed.graduationYears,
    deadline: deadline && !Number.isNaN(deadline.getTime()) ? deadline : null,
  };
}

const rawToText = (raw: RawJob) => `${raw.title ?? ""}\n${raw.company ? `Company: ${raw.company}\n` : ""}${raw.location ? `Location: ${raw.location}\n` : ""}${raw.description}`;
