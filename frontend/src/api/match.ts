import { ApiRequestError, jsonBody, qs, request, requestData } from "./http";
import type { ApplicationEvent, ApplicationStatus, ClaimCheck, FitBrief, FitResult, Job, ResumeForJob } from "./types";

export interface JobWithFit extends Job {
  fit?: FitBrief | null;
}

export interface JobsPageResult {
  jobs: JobWithFit[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** `GET /jobs?withFit=true`: the list is in `data`, paging fields sit next to it. */
export async function fetchJobsWithFit(
  token: string,
  params: { search?: string; location?: string; workMode?: string; employmentType?: string; page?: number; limit?: number } = {},
): Promise<JobsPageResult> {
  const res = await request<{ data: JobWithFit[]; total: number; page: number; limit: number; totalPages: number }>(
    "/jobs" + qs({ withFit: true, ...params }),
    token,
  );
  return { jobs: res.data ?? [], total: res.total ?? 0, page: res.page ?? 1, limit: res.limit ?? 20, totalPages: res.totalPages ?? 1 };
}

export const fetchJobDetail = (token: string, jobId: string) => requestData<Job>(`/jobs/${jobId}`, token);

export const fetchJobFit = (token: string, jobId: string) => requestData<FitResult>(`/jobs/${jobId}/fit`, token);

export const buildResumeForJob = (token: string, jobId: string, resumeId?: string) =>
  requestData<ResumeForJob>(`/jobs/${jobId}/resume`, token, { method: "POST", ...jsonBody(resumeId ? { resumeId } : {}) });

export const fetchClaimCheck = (token: string, resumeId: string) => requestData<ClaimCheck>(`/students/me/resumes/${resumeId}/claim-check`, token);

export interface Recommendation {
  jobId: string;
  title: string;
  company: string | null;
  fitScore: number | null;
  band: FitResult["band"];
  eligible: boolean;
  requiredDemonstrated: number;
  requiredTotal: number;
  explanation: string;
}

export const fetchRecommendations = (token: string) => requestData<Recommendation[]>("/students/me/recommendations", token);

export interface Application {
  id: string;
  jobPostingId?: string;
  status: ApplicationStatus;
  appliedAt: string;
  updatedAt?: string;
  fitScore: number | null;
  fitSnapshot: Pick<FitResult, "band" | "explanation" | "requiredTotal" | "requiredDemonstrated"> | null;
  jobPosting?: Pick<Job, "id" | "title"> & { company?: { id: string; name: string } | null };
  events?: ApplicationEvent[];
}

export const applyToJobDetailed = (token: string, jobId: string) =>
  requestData<Application>(`/jobs/${jobId}/applications`, token, { method: "POST", ...jsonBody({}) });

export const fetchMyApplications = (token: string) => requestData<Application[]>("/students/me/applications", token);

export const withdrawApplication = (token: string, applicationId: string) =>
  requestData<unknown>(`/students/me/applications/${applicationId}/withdraw`, token, { method: "POST", ...jsonBody({}) });

/** Uploaded resumes, only what the pickers need. */
export const fetchResumeChoices = (token: string) => requestData<{ id: string; createdAt: string }[]>("/students/me/resumes", token);

export const errorMessage = (e: unknown, fallback = "Something went wrong.") => (e instanceof Error && e.message ? e.message : fallback);

export const errorCode = (e: unknown): string | undefined => (e instanceof ApiRequestError ? e.code : undefined);
