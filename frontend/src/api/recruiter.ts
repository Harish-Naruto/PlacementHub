const API_BASE = "http://localhost:4000/api/v1/recruiters";
const SKILLS_API_BASE = "http://localhost:4000/api/v1/skills";


function authHeaders(token: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function apiFetch<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...authHeaders(token), ...(init?.headers ?? {}) },
    credentials: "include",
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.message || "Request failed");
  return json.data as T;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CompanyProfile {
  companyName: string;
  companySlug?: string;
  companyWebsite?: string;
  companyDescription?: string;
  companyCity?: string;
  companyCountry?: string;
  jobTitle?: string;
}

export interface RecruiterProfileData {
  id: string;
  jobTitle: string | null;
  company: {
    id: string;
    name: string;
    slug: string;
    website: string | null;
    description: string | null;
    city: string | null;
    country: string | null;
  };
}

export interface SkillRequirement {
  skillId: string;
  requirementType: "REQUIRED" | "PREFERRED";
  weight?: number;
}

export interface Skill {
  id: string;
  name: string;
  category: string | null;
}

export interface JobPayload {
  title: string;
  description: string;
  location?: string;
  workMode?: "ONSITE" | "HYBRID" | "REMOTE";
  employmentType?: "FULL_TIME" | "INTERNSHIP" | "CONTRACT" | "PART_TIME";
  minimumCgpa?: number;
  applicationDeadline?: string;
  externalUrl?: string;
  skillRequirements?: SkillRequirement[];
  eligibleBranches?: string[];
  eligibleGraduationYears?: number[];
  status?: "DRAFT" | "PUBLISHED";
}

export interface JobPosting {
  id: string;
  title: string;
  description: string;
  location: string | null;
  workMode: "ONSITE" | "HYBRID" | "REMOTE";
  employmentType: "FULL_TIME" | "INTERNSHIP" | "CONTRACT" | "PART_TIME";
  minimumCgpa: string | null;
  applicationDeadline: string | null;
  externalUrl: string | null;
  status: "DRAFT" | "PUBLISHED" | "PAUSED" | "CLOSED";
  createdAt: string;
  updatedAt: string;
  _count?: { applications: number };
  eligibleBranches?: { branch: string }[];
  graduationYears?: { graduationYear: number }[];
  skillRequirements?: {
    requirementType: "REQUIRED" | "PREFERRED";
    weight: string;
    skill: { id: string; name: string; category: string | null };
  }[];
}

export interface ApplicationSummary {
  id: string;
  status: string;
  appliedAt: string;
  updatedAt: string;
  studentProfile: {
    id: string;
    branch: string | null;
    degree: string | null;
    graduationYear: number | null;
    cgpa: string | null;
    user: { name: string | null; email: string };
  };
}

export interface ApplicationDetail extends ApplicationSummary {
  resumeUrl: string | null;
  jobPosting: { id: string; title: string };
  events: ApplicationEvent[];
  studentProfile: ApplicationSummary["studentProfile"] & {
    githubUsername: string | null;
    linkedinUrl: string | null;
    bio: string | null;
    institution: { name: string };
    skills: {
      verificationStatus: string;
      declaredLevel: string | null;
      skill: { name: string; category: string | null };
    }[];
    projects: {
      id: string;
      title: string;
      description: string;
      status: string;
      repositoryUrl: string | null;
      demoUrl: string | null;
    }[];
  };
}

export interface ApplicationEvent {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: string;
  actor: { name: string | null; email: string };
}

// ── API Functions ─────────────────────────────────────────────────────────────

export const getRecruiterProfile = async (token: string): Promise<RecruiterProfileData | null> => {
  const res = await apiFetch<{ profile: RecruiterProfileData | null }>(`${API_BASE}/me/profile`, token);
  return res?.profile ?? null;
};

export const upsertRecruiterProfile = async (
  token: string,
  body: CompanyProfile
): Promise<RecruiterProfileData> => {
  const res = await apiFetch<{ profile: RecruiterProfileData; company?: any }>(`${API_BASE}/me/profile`, token, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return res.profile;
};

export const getMyJobs = async (
  token: string,
  params?: { status?: string; page?: number; limit?: number }
): Promise<{ jobs: JobPosting[]; total: number; page: number; totalPages: number }> => {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : "";
  const res = await apiFetch<{ jobs: JobPosting[]; total: number; page: number; limit?: number }>(
    `${API_BASE}/me/jobs${query}`,
    token
  );
  const limit = res.limit || params?.limit || 10;
  const totalPages = Math.max(1, Math.ceil((res.total || 0) / limit));
  return {
    jobs: res.jobs || [],
    total: res.total || 0,
    page: res.page || 1,
    totalPages,
  };
};

export const createJob = async (token: string, body: JobPayload): Promise<JobPosting> => {
  const res = await apiFetch<{ job: JobPosting }>(`${API_BASE}/me/jobs`, token, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.job;
};

export const getJobById = async (token: string, jobId: string): Promise<JobPosting> => {
  const res = await apiFetch<{ job: JobPosting }>(`${API_BASE}/me/jobs/${jobId}`, token);
  return res.job;
};

export const updateJob = async (
  token: string,
  jobId: string,
  body: Partial<JobPayload>
): Promise<JobPosting> => {
  const res = await apiFetch<{ job: JobPosting }>(`${API_BASE}/me/jobs/${jobId}`, token, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return res.job;
};

export const publishJob = async (token: string, jobId: string): Promise<JobPosting> => {
  const res = await apiFetch<{ job: JobPosting }>(`${API_BASE}/me/jobs/${jobId}/publish`, token, {
    method: "POST",
  });
  return res.job;
};

export const closeJob = async (token: string, jobId: string): Promise<JobPosting> => {
  const res = await apiFetch<{ job: JobPosting }>(`${API_BASE}/me/jobs/${jobId}/close`, token, {
    method: "POST",
  });
  return res.job;
};

export const pauseJob = async (token: string, jobId: string): Promise<JobPosting> => {
  const res = await apiFetch<{ job: JobPosting }>(`${API_BASE}/me/jobs/${jobId}/pause`, token, {
    method: "POST",
  });
  return res.job;
};

export const getJobApplications = async (
  token: string,
  jobId: string,
  params?: { status?: string; page?: number; limit?: number }
): Promise<{ applications: ApplicationSummary[]; total: number; page: number; totalPages: number }> => {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : "";
  const res = await apiFetch<{ applications: ApplicationSummary[]; total: number; page: number; limit?: number }>(
    `${API_BASE}/me/jobs/${jobId}/applications${query}`,
    token
  );
  const limit = res.limit || params?.limit || 10;
  const totalPages = Math.max(1, Math.ceil((res.total || 0) / limit));
  return {
    applications: res.applications || [],
    total: res.total || 0,
    page: res.page || 1,
    totalPages,
  };
};

export const getApplication = async (token: string, applicationId: string): Promise<ApplicationDetail> => {
  const res = await apiFetch<{ application: ApplicationDetail }>(
    `${API_BASE}/me/applications/${applicationId}`,
    token
  );
  return res.application;
};

export const updateApplicationStatus = async (
  token: string,
  applicationId: string,
  status: string,
  note?: string
): Promise<ApplicationDetail> => {
  const res = await apiFetch<{ application: ApplicationDetail }>(
    `${API_BASE}/me/applications/${applicationId}/status`,
    token,
    {
      method: "PATCH",
      body: JSON.stringify({ status, note }),
    }
  );
  return res.application;
};

export const getApplicationEvents = async (
  token: string,
  applicationId: string
): Promise<ApplicationEvent[]> => {
  const res = await apiFetch<{ events: ApplicationEvent[] }>(
    `${API_BASE}/me/applications/${applicationId}/events`,
    token
  );
  return res.events || [];
};

// ── Skills (public, no auth required) ──────────────────────────────────────

export const searchSkills = async (
  q: string,
  category?: string,
  limit = 20
): Promise<Skill[]> => {
  const qs = new URLSearchParams({ q, limit: String(limit) });
  if (category) qs.set("category", category);
  const res = await fetch(`${SKILLS_API_BASE}/search?${qs.toString()}`);
  const json = await res.json();
  if (!res.ok || json.error) return [];
  return (json.data?.skills ?? []) as Skill[];
};

export const getSkillCategories = async (): Promise<string[]> => {
  const res = await fetch(`${SKILLS_API_BASE}/categories`);
  const json = await res.json();
  if (!res.ok || json.error) return [];
  return (json.data?.categories ?? []) as string[];
};
