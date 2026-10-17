// ---------------------------------------------------------------------------
// Recruiter API Client
// ---------------------------------------------------------------------------

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api/v1";

async function request<T>(
  endpoint: string,
  token?: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `HTTP error ${response.status}`);
  }

  return data;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export type WorkMode = "ONSITE" | "HYBRID" | "REMOTE";
export type EmploymentType = "FULL_TIME" | "INTERNSHIP" | "CONTRACT" | "PART_TIME";
export type JobStatus = "DRAFT" | "PUBLISHED" | "PAUSED" | "CLOSED";
export type JobRequirementType = "REQUIRED" | "PREFERRED";

export type ApplicationStatus =
  | "APPLIED"
  | "IN_REVIEW"
  | "SHORTLISTED"
  | "INTERVIEW_SCHEDULED"
  | "INTERVIEWING"
  | "OFFERED"
  | "HIRED"
  | "REJECTED"
  | "WITHDRAWN";

export interface Company {
  id: string;
  name: string;
  slug: string;
  website?: string | null;
  description?: string | null;
  city?: string | null;
  country?: string | null;
}

export interface RecruiterProfile {
  id: string;
  userId: string;
  companyId: string;
  jobTitle?: string | null;
  company: Company;
  user?: {
    id: string;
    name: string | null;
    email: string;
    profileImage: string | null;
  };
  _count?: {
    jobs: number;
  };
}

export interface SkillRequirement {
  skillId: string;
  requirementType: JobRequirementType;
  weight: number;
  skill: {
    id: string;
    name: string;
    category?: string | null;
  };
}

export interface RecruiterJob {
  id: string;
  title: string;
  description: string;
  location?: string | null;
  workMode: WorkMode;
  employmentType: EmploymentType;
  minimumCgpa?: number | null;
  applicationDeadline?: string | null;
  externalUrl?: string | null;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  recruiterProfile?: {
    company: Company;
  };
  eligibleBranches?: { branch: string }[];
  graduationYears?: { graduationYear: number }[];
  skillRequirements?: SkillRequirement[];
  _count?: {
    applications: number;
  };
}

export interface CreateJobPayload {
  title: string;
  description: string;
  location?: string | null;
  workMode?: WorkMode;
  employmentType?: EmploymentType;
  minimumCgpa?: number | null;
  applicationDeadline?: string | null;
  externalUrl?: string | null;
  status?: JobStatus;
  eligibleBranches?: string[];
  graduationYears?: number[];
  skillRequirements?: {
    skillId?: string;
    skillName?: string;
    requirementType?: JobRequirementType;
    weight?: number;
  }[];
}

export interface CandidateApplication {
  id: string;
  status: ApplicationStatus;
  appliedAt: string;
  resumeUrl?: string | null;
  studentProfile: {
    id: string;
    branch?: string | null;
    degree?: string | null;
    graduationYear?: number | null;
    cgpa?: number | null;
    githubUsername?: string | null;
    linkedinUrl?: string | null;
    institution?: {
      name: string;
      city?: string | null;
    } | null;
    user: {
      id: string;
      name: string | null;
      email: string;
      profileImage?: string | null;
    };
    skills?: {
      skill: {
        id: string;
        name: string;
      };
      declaredLevel?: string | null;
      verificationStatus: string;
    }[];
  };
  events?: {
    id: string;
    fromStatus?: string | null;
    toStatus: string;
    note?: string | null;
    createdAt: string;
  }[];
}

export interface ApplicationEventItem {
  id: string;
  fromStatus?: string | null;
  toStatus: string;
  note?: string | null;
  createdAt: string;
  actor?: {
    id: string;
    name?: string | null;
    email: string;
    role: string;
  };
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

export async function fetchRecruiterProfile(token: string): Promise<RecruiterProfile | null> {
  const res = await request<{ error: boolean; data: { profile: RecruiterProfile | null } }>(
    "/recruiters/me/profile",
    token,
  );
  return res.data.profile;
}

export async function updateRecruiterProfile(
  token: string,
  payload: {
    jobTitle?: string | null;
    companyName?: string;
    website?: string | null;
    description?: string | null;
    city?: string | null;
    country?: string | null;
  },
): Promise<{ profile: RecruiterProfile; company: Company }> {
  const res = await request<{ error: boolean; data: { profile: RecruiterProfile; company: Company } }>(
    "/recruiters/me/profile",
    token,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
  return res.data;
}

export async function fetchRecruiterJobs(
  token: string,
  params: { page?: number; limit?: number; status?: string } = {},
): Promise<{ jobs: RecruiterJob[]; total: number; page: number; limit: number; totalPages: number }> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", String(params.page));
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.status) searchParams.set("status", params.status);

  const qs = searchParams.toString();
  const url = qs ? `/recruiters/me/jobs?${qs}` : "/recruiters/me/jobs";

  const res = await request<{
    error: boolean;
    data: { jobs: RecruiterJob[]; total: number; page: number; limit: number; totalPages: number };
  }>(url, token);
  return res.data;
}

export async function fetchRecruiterJob(token: string, jobId: string): Promise<RecruiterJob> {
  const res = await request<{ error: boolean; data: { job: RecruiterJob } }>(
    `/recruiters/me/jobs/${jobId}`,
    token,
  );
  return res.data.job;
}

export async function createRecruiterJob(token: string, payload: CreateJobPayload): Promise<RecruiterJob> {
  const res = await request<{ error: boolean; data: { job: RecruiterJob } }>(
    "/recruiters/me/jobs",
    token,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return res.data.job;
}

export async function updateRecruiterJob(
  token: string,
  jobId: string,
  payload: Partial<CreateJobPayload>,
): Promise<RecruiterJob> {
  const res = await request<{ error: boolean; data: { job: RecruiterJob } }>(
    `/recruiters/me/jobs/${jobId}`,
    token,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
  return res.data.job;
}

export async function publishRecruiterJob(token: string, jobId: string): Promise<RecruiterJob> {
  const res = await request<{ error: boolean; data: { job: RecruiterJob } }>(
    `/recruiters/me/jobs/${jobId}/publish`,
    token,
    {
      method: "POST",
    },
  );
  return res.data.job;
}

export async function pauseRecruiterJob(token: string, jobId: string): Promise<RecruiterJob> {
  const res = await request<{ error: boolean; data: { job: RecruiterJob } }>(
    `/recruiters/me/jobs/${jobId}/pause`,
    token,
    {
      method: "POST",
    },
  );
  return res.data.job;
}

export async function closeRecruiterJob(token: string, jobId: string): Promise<RecruiterJob> {
  const res = await request<{ error: boolean; data: { job: RecruiterJob } }>(
    `/recruiters/me/jobs/${jobId}/close`,
    token,
    {
      method: "POST",
    },
  );
  return res.data.job;
}

export async function fetchJobApplications(
  token: string,
  jobId: string,
  params: { page?: number; limit?: number; status?: string } = {},
): Promise<{
  job: { id: string; title: string; status: JobStatus };
  applications: CandidateApplication[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", String(params.page));
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.status) searchParams.set("status", params.status);

  const qs = searchParams.toString();
  const url = qs
    ? `/recruiters/me/jobs/${jobId}/applications?${qs}`
    : `/recruiters/me/jobs/${jobId}/applications`;

  const res = await request<{
    error: boolean;
    data: {
      job: { id: string; title: string; status: JobStatus };
      applications: CandidateApplication[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }>(url, token);
  return res.data;
}

export async function fetchRecruiterApplication(
  token: string,
  applicationId: string,
): Promise<any> {
  const res = await request<{ error: boolean; data: { application: any } }>(
    `/recruiters/me/applications/${applicationId}`,
    token,
  );
  return res.data.application;
}

export async function updateApplicationStatusApi(
  token: string,
  applicationId: string,
  payload: { status: ApplicationStatus; note?: string },
): Promise<any> {
  const res = await request<{ error: boolean; data: { application: any } }>(
    `/recruiters/me/applications/${applicationId}/status`,
    token,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
  return res.data.application;
}

export async function fetchApplicationEvents(
  token: string,
  applicationId: string,
): Promise<ApplicationEventItem[]> {
  const res = await request<{ error: boolean; data: { events: ApplicationEventItem[] } }>(
    `/recruiters/me/applications/${applicationId}/events`,
    token,
  );
  return res.data.events;
}
