import { jsonBody, qs, requestData } from "./http";
import type { ApplicationEvent, ApplicationStatus, FitBand, GapKind, Job, JobSourceInfo, JobStatus, Requirement, SourceType, Stage } from "./types";

// ---- stats ---------------------------------------------------------------------------------------

export interface PlacementStats {
  students: number;
  jobs: Partial<Record<JobStatus, number>>;
  jobsBySource: Partial<Record<SourceType, number>>;
  jobsSeenInMultipleSources: number;
  applicationsByStage: Record<Stage, number>;
}

export const fetchPlacementStats = (token: string) => requestData<PlacementStats>("/placement/stats", token);

// ---- ingest --------------------------------------------------------------------------------------

export type PasteSourceType = "PARTNER_POSTING" | "ALUMNI_REFERRAL" | "OTHER";
export type DuplicateKind = "exact" | "fuzzy" | "same_source";

export interface IngestResult {
  jobId: string;
  created: boolean;
  duplicate: null | { kind: DuplicateKind; similarity: number };
  parseMethod: "llm" | "rules";
  skills: { required: string[]; preferred: string[] };
  sourceCount: number;
}

export interface IngestPasteInput {
  text: string;
  sourceType: PasteSourceType;
  sourceLabel?: string;
  company?: string;
  title?: string;
  location?: string;
}

export const ingestPaste = (token: string, body: IngestPasteInput) =>
  requestData<IngestResult>("/placement/ingest/paste", token, { method: "POST", ...jsonBody(body) });

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

export const ingestFromApi = (token: string, adapter: "remotive") =>
  requestData<ApiIngestSummary>("/placement/ingest/api", token, { method: "POST", ...jsonBody({ adapter }) });

// ---- openings ------------------------------------------------------------------------------------

export interface PlacementJob extends Job {
  sources: JobSourceInfo[];
  _count: { applications: number };
}

export const fetchPlacementJobs = (token: string, params: { status?: string; search?: string } = {}) =>
  requestData<PlacementJob[]>("/placement/jobs" + qs(params), token);

export const patchPlacementJobSkills = (token: string, jobId: string, body: { required: string[]; preferred: string[] }) =>
  requestData<PlacementJob>(`/placement/jobs/${jobId}`, token, { method: "PATCH", ...jsonBody(body) });

export const setPlacementJobStatus = (token: string, jobId: string, action: "publish" | "pause" | "close") =>
  requestData<PlacementJob>(`/placement/jobs/${jobId}/${action}`, token, { method: "POST", ...jsonBody({}) });

// ---- batch ranking -------------------------------------------------------------------------------

export interface RankFilter {
  institutionId?: string;
  branch?: string;
  graduationYear?: number;
  minCgpa?: number;
}

export interface RankRequest {
  jobId?: string;
  jobDescription?: string;
  filter: RankFilter;
  limit: number;
  includeIneligible: boolean;
}

export interface RankedJobSummary {
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

export interface RankRow {
  rank: number;
  studentProfileId: string;
  name: string;
  email: string;
  institution: string | null;
  branch: string | null;
  cgpa: number | null;
  graduationYear: number | null;
  githubUsername: string | null;
  fitScore: number | null;
  band: FitBand;
  eligible: boolean;
  eligibilityFlags: string[];
  eligibilityUnknown: string[];
  requiredDemonstrated: number;
  requiredTotal: number;
  matched: { skill: string; requirement: Requirement; combinedScore: number | null }[];
  gaps: { skill: string; requirement: Requirement; kind: GapKind; detail: string }[];
  explanation: string;
  verifiedSkills: number;
  flaggedSkills: number;
}

export interface RankResponse {
  job: RankedJobSummary;
  totalStudents: number;
  returned: number;
  rows: RankRow[];
}

export const rankBatch = (token: string, body: RankRequest) =>
  requestData<RankResponse>("/placement/rank", token, { method: "POST", ...jsonBody(body) });

// ---- pipeline ------------------------------------------------------------------------------------

export interface PlacementApplication {
  id: string;
  status: ApplicationStatus;
  stage: Stage;
  fitScore: number | null;
  appliedAt: string;
  updatedAt: string;
  jobPosting: { id: string; title: string; company: { id: string; name: string } | null };
  studentProfile: { id: string; branch: string | null; graduationYear: number | null; cgpa: number | string | null; user: { name: string | null; email: string } };
}

export interface PlacementApplicationDetail extends PlacementApplication {
  events: ApplicationEvent[];
}

export const fetchPlacementApplications = (token: string, params: { institutionId?: string } = {}) =>
  requestData<PlacementApplication[]>("/placement/applications" + qs(params), token);

export const fetchPlacementApplication = (token: string, id: string) => requestData<PlacementApplicationDetail>(`/placement/applications/${id}`, token);

export const changePlacementApplicationStatus = (token: string, id: string, status: ApplicationStatus, note?: string) =>
  requestData<PlacementApplicationDetail>(`/placement/applications/${id}/status`, token, { method: "PATCH", ...jsonBody({ status, ...(note ? { note } : {}) }) });

// ---- students ------------------------------------------------------------------------------------

export interface PlacementStudent {
  studentProfileId: string;
  name: string;
  email: string;
  institution: string | null;
  branch: string | null;
  cgpa: number | null;
  graduationYear: number | null;
  githubUsername: string | null;
  skills: number;
  verifiedSkills: number;
  flaggedSkills: number;
  applications: number;
  interviewing: number;
  offers: number;
}

export const fetchPlacementStudents = (token: string, filter: RankFilter = {}) => requestData<PlacementStudent[]>("/placement/students" + qs({ ...filter }), token);
