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

export interface Institution {
  id: string;
  name: string;
  slug: string;
  city?: string;
  state?: string;
}

export interface StudentProfileData {
  id?: string;
  userId?: string;
  institutionId?: string | null;
  branch?: string | null;
  degree?: string | null;
  graduationYear?: number | null;
  cgpa?: number | null;
  githubUsername?: string | null;
  linkedinUrl?: string | null;
  bio?: string | null;
  name?: string;
  institution?: Institution | null;
  skills?: any[];
  projects?: any[];
}

export interface StudentSkill {
  id: string;
  skillId: string;
  declaredLevel: string | null;
  verificationStatus: string;
  skill: {
    id: string;
    name: string;
    category?: string | null;
  };
}

export interface ProjectData {
  id: string;
  title: string;
  description: string;
  personalContribution?: string | null;
  repositoryUrl?: string | null;
  demoUrl?: string | null;
  status: string;
  skills?: { skill: { id: string; name: string } }[];
}

export interface JobData {
  id: string;
  title: string;
  description: string;
  location?: string | null;
  workMode: string;
  employmentType: string;
  status: string;
  recruiterProfile?: {
    company?: {
      name: string;
      city?: string | null;
      country?: string | null;
    };
  };
}

export interface ApplicationData {
  id: string;
  status: string;
  appliedAt: string;
  jobPosting?: JobData;
  events?: { id: string; toStatus: string; createdAt: string; note?: string | null }[];
}

// ---------------------------------------------------------------------------
// Student API calls
// ---------------------------------------------------------------------------

export async function fetchInstitutions(): Promise<Institution[]> {
  const res = await request<{ error: boolean; data: Institution[] }>("/institutions");
  return res.data;
}

export async function fetchStudentProfile(token: string): Promise<StudentProfileData> {
  const res = await request<{ error: boolean; data: StudentProfileData }>("/students/me/profile", token);
  return res.data;
}

export async function updateStudentProfile(
  token: string,
  data: Partial<StudentProfileData>,
): Promise<StudentProfileData> {
  const res = await request<{ error: boolean; data: StudentProfileData }>("/students/me/profile", token, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function uploadResumeApi(
  token: string,
  file: File,
): Promise<{ success: boolean; message: string; fileName?: string }> {
  const formData = new FormData();
  formData.append("resume", file);

  const res = await request<{ error: boolean; success: boolean; message: string; fileName?: string }>(
    "/students/me/resume",
    token,
    {
      method: "POST",
      body: formData,
    },
  );
  return res;
}

export async function fetchStudentSkills(token: string): Promise<StudentSkill[]> {
  const res = await request<{ error: boolean; data: StudentSkill[] }>("/students/me/skills", token);
  return res.data;
}

export async function addStudentSkill(
  token: string,
  skillName: string,
  declaredLevel: string,
): Promise<StudentSkill> {
  const res = await request<{ error: boolean; data: StudentSkill }>("/students/me/skills", token, {
    method: "POST",
    body: JSON.stringify({ skillName, declaredLevel }),
  });
  return res.data;
}

export async function deleteStudentSkill(token: string, skillId: string): Promise<void> {
  await request(`/students/me/skills/${skillId}`, token, { method: "DELETE" });
}

export async function fetchStudentProjects(token: string): Promise<ProjectData[]> {
  const res = await request<{ error: boolean; data: ProjectData[] }>("/students/me/projects", token);
  return res.data;
}

export async function createStudentProject(
  token: string,
  data: {
    title: string;
    description: string;
    personalContribution?: string;
    repositoryUrl?: string;
    demoUrl?: string;
    skillNames?: string[];
  },
): Promise<ProjectData> {
  const res = await request<{ error: boolean; data: ProjectData }>("/students/me/projects", token, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function deleteStudentProject(token: string, projectId: string): Promise<void> {
  await request(`/students/me/projects/${projectId}`, token, { method: "DELETE" });
}

export async function fetchJobs(token: string): Promise<JobData[]> {
  const res = await request<{ error: boolean; data: JobData[] }>("/jobs", token);
  return res.data || [];
}

export async function applyToJob(token: string, jobId: string): Promise<ApplicationData> {
  const res = await request<{ error: boolean; data: ApplicationData }>(`/jobs/${jobId}/applications`, token, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return res.data;
}

export async function fetchApplications(token: string): Promise<ApplicationData[]> {
  const res = await request<{ error: boolean; data: ApplicationData[] }>("/students/me/applications", token);
  return res.data || [];
}

export async function withdrawApplicationApi(token: string, applicationId: string): Promise<void> {
  await request(`/students/me/applications/${applicationId}/withdraw`, token, {
    method: "POST",
  });
}
