import { jsonBody, qs, requestData } from "./http";
import type {
  ApplicationEvent,
  ApplicationStatus,
  ClaimSummary,
  EmploymentType,
  FitBand,
  FitResult,
  GapKind,
  GeneratedResume,
  Job,
  JobStatus,
  Requirement,
  Stage,
  WorkMode,
} from "./types";

// ---- company profile -----------------------------------------------------------------------------

export interface RecruiterCompany {
  id: string;
  name: string;
  website: string | null;
  city: string | null;
  country: string | null;
  description: string | null;
}

export interface RecruiterProfileData {
  user: { id: string; name: string | null; email: string };
  profile: null | { id: string; jobTitle: string | null; companyId: string; company: RecruiterCompany };
}

export interface RecruiterProfileInput {
  companyName: string;
  website?: string;
  city?: string;
  country?: string;
  description?: string;
  jobTitle?: string;
}

export const fetchRecruiterProfile = (token: string) => requestData<RecruiterProfileData>("/recruiter/me", token);
export const saveRecruiterProfile = (token: string, input: RecruiterProfileInput) =>
  requestData<RecruiterProfileData>("/recruiter/me", token, { method: "PUT", ...jsonBody(input) });

// ---- jobs ----------------------------------------------------------------------------------------

export interface RecruiterJob extends Job {
  applicants: number;
  applicantsByStage: Record<Stage, number>;
}

export interface JobPatch {
  title?: string;
  description?: string;
  location?: string | null;
  workMode?: WorkMode;
  employmentType?: EmploymentType;
  minimumCgpa?: number | null;
  applicationDeadline?: string | null;
  externalUrl?: string | null;
  required?: string[];
  preferred?: string[];
  eligibleBranches?: string[];
  graduationYears?: number[];
}

export type CreateJobBody = JobPatch & { jobDescription?: string };

export interface CreateJobResult {
  job: Job;
  parseMethod: "llm" | "rules";
  possibleDuplicate: null | { jobId: string; kind: "exact" | "fuzzy"; similarity: number };
}

export const fetchRecruiterJobs = (token: string, status?: JobStatus) => requestData<RecruiterJob[]>("/recruiter/jobs" + qs({ status }), token);
export const fetchRecruiterJob = (token: string, jobId: string) => requestData<Job>(`/recruiter/jobs/${jobId}`, token);
export const createRecruiterJob = (token: string, body: CreateJobBody) =>
  requestData<CreateJobResult>("/recruiter/jobs", token, { method: "POST", ...jsonBody(body) });
export const patchRecruiterJob = (token: string, jobId: string, patch: JobPatch) =>
  requestData<Job>(`/recruiter/jobs/${jobId}`, token, { method: "PATCH", ...jsonBody(patch) });
export const setRecruiterJobStatus = (token: string, jobId: string, action: "publish" | "pause" | "close") =>
  requestData<Job>(`/recruiter/jobs/${jobId}/${action}`, token, { method: "POST" });
export const deleteRecruiterJob = (token: string, jobId: string) =>
  requestData<{ deleted: boolean }>(`/recruiter/jobs/${jobId}`, token, { method: "DELETE" });

// ---- applicants ----------------------------------------------------------------------------------

export interface ApplicantsFilter {
  stage?: Stage;
  minFit?: number;
  eligibleOnly?: boolean;
}

export interface ApplicantRow {
  rank: number;
  applicationId: string;
  status: ApplicationStatus;
  stage: Stage;
  appliedAt: string;
  updatedAt: string;
  studentProfileId: string;
  name: string;
  email: string;
  institution: string | null;
  branch: string | null;
  cgpa: number | null;
  graduationYear: number | null;
  githubUsername: string | null;
  fitAtApply: number | null;
  claimCheck: null | { flagged: number; total: number };
  verifiedSkills: number;
  flaggedSkills: number;
  fitScore: number | null;
  band: FitBand;
  eligible: boolean;
  eligibilityFlags: string[];
  matched: { skill: string; requirement: Requirement; combinedScore: number | null }[];
  gaps: { skill: string; requirement: Requirement; kind: GapKind; detail: string }[];
  explanation: string;
}

export interface ApplicantsResponse {
  job: { id: string; title: string; status: JobStatus; required: string[]; preferred: string[] };
  total: number;
  rows: ApplicantRow[];
}

export const fetchApplicants = (token: string, jobId: string, filter: ApplicantsFilter) =>
  requestData<ApplicantsResponse>(
    `/recruiter/jobs/${jobId}/applicants` + qs({ stage: filter.stage, minFit: filter.minFit, eligibleOnly: filter.eligibleOnly ? "true" : undefined }),
    token,
  );

export interface ApplicantSkill {
  skill: string;
  /** EVALUATED | REPOSITORY_OBSERVED | NEEDS_REVIEW | SELF_DECLARED */
  status: string;
  assessmentScore: number | null;
  githubScore: number | null;
  combinedScore: number | null;
  evidenceStrength: string | null;
  proof: { sourceType: string; sourceUrl: string | null; description: string | null; status: string }[];
}

export interface ResumeSnapshot {
  generatedAt: string;
  resume: GeneratedResume;
  claimSummary: ClaimSummary | null;
}

export interface ApplicantDetail {
  application: {
    id: string;
    status: ApplicationStatus;
    stage: Stage;
    appliedAt: string;
    jobPosting: { id: string; title: string; company?: { id: string; name: string } | null };
    studentProfile: { id: string; branch: string | null; graduationYear: number | null; cgpa: number | string | null; user: { name: string | null; email: string } };
    events: ApplicationEvent[];
  };
  fitAtApply: { score: number | null; snapshot: unknown };
  fitNow: FitResult | null;
  resumeSnapshot: ResumeSnapshot | null;
  skills: ApplicantSkill[];
}

export const fetchApplicantDetail = (token: string, applicationId: string) => requestData<ApplicantDetail>(`/recruiter/applications/${applicationId}`, token);
export const changeApplicantStatus = (token: string, applicationId: string, status: ApplicationStatus, note?: string) =>
  requestData<unknown>(`/recruiter/applications/${applicationId}/status`, token, { method: "PATCH", ...jsonBody({ status, ...(note ? { note } : {}) }) });
