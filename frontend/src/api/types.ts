// Shapes returned by the backend that more than one screen uses. They mirror the backend modules:
//   backend/src/matching/fit.ts, backend/src/resumeBuilder/*.ts, backend/src/pipeline/transitions.ts,
//   backend/src/services/job.service.ts

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

export type Stage = "Applied" | "Interview" | "Offer" | "Closed";

export const STAGE_ORDER: Stage[] = ["Applied", "Interview", "Offer", "Closed"];

export const STAGE_STATUSES: Record<Stage, ApplicationStatus[]> = {
  Applied: ["APPLIED", "IN_REVIEW", "SHORTLISTED"],
  Interview: ["INTERVIEW_SCHEDULED", "INTERVIEWING"],
  Offer: ["OFFERED", "HIRED"],
  Closed: ["REJECTED", "WITHDRAWN"],
};

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  APPLIED: "Applied",
  IN_REVIEW: "In review",
  SHORTLISTED: "Shortlisted",
  INTERVIEW_SCHEDULED: "Interview scheduled",
  INTERVIEWING: "Interviewing",
  OFFERED: "Offered",
  HIRED: "Hired",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

const FORWARD: ApplicationStatus[] = ["APPLIED", "IN_REVIEW", "SHORTLISTED", "INTERVIEW_SCHEDULED", "INTERVIEWING", "OFFERED", "HIRED"];

/** Same rule as the server (backend/src/pipeline/transitions.ts), used to show only valid buttons. The server still validates. */
export function allowedNext(from: ApplicationStatus): ApplicationStatus[] {
  if (from === "HIRED" || from === "REJECTED" || from === "WITHDRAWN") return [];
  const later = FORWARD.slice(FORWARD.indexOf(from) + 1).filter((s) => s !== "HIRED" || from === "OFFERED");
  return [...later, "REJECTED"];
}

export const stageOf = (s: ApplicationStatus): Stage => (Object.entries(STAGE_STATUSES).find(([, v]) => v.includes(s))?.[0] as Stage) ?? "Applied";

// ---- fit -----------------------------------------------------------------------------------------

export type FitBand = "Strong" | "Good" | "Partial" | "Low" | "Unknown";
export type GapKind = "missing" | "claimed_only" | "weak" | "observed_only";
export type Requirement = "REQUIRED" | "PREFERRED";

export interface MatchedSkill {
  skill: string;
  requirement: Requirement;
  credit: number;
  combinedScore: number | null;
  detail: string;
  evidenceUrls: string[];
}

export interface Gap {
  skill: string;
  kind: GapKind;
  requirement: Requirement;
  detail: string;
  /** What the student can do about it. */
  action: string;
}

export interface Eligibility {
  eligible: boolean;
  /** Reasons the student is not eligible. */
  flags: string[];
  /** Checks that could not be made because the profile is missing data. */
  unknown: string[];
}

export interface FitResult {
  fitScore: number | null;
  band: FitBand;
  matched: MatchedSkill[];
  gaps: Gap[];
  eligibility: Eligibility;
  explanation: string;
  requiredTotal: number;
  requiredDemonstrated: number;
}

export interface FitBrief {
  fitScore: number | null;
  band: FitBand;
  eligible: boolean;
  requiredDemonstrated: number;
  requiredTotal: number;
}

// ---- jobs ----------------------------------------------------------------------------------------

export type JobStatus = "DRAFT" | "PUBLISHED" | "PAUSED" | "CLOSED";
export type WorkMode = "ONSITE" | "HYBRID" | "REMOTE";
export type EmploymentType = "FULL_TIME" | "INTERNSHIP" | "CONTRACT" | "PART_TIME";
export type SourceType = "RECRUITER_POSTED" | "PARTNER_POSTING" | "ALUMNI_REFERRAL" | "JOB_API" | "OTHER";

export const SOURCE_LABEL: Record<SourceType, string> = {
  RECRUITER_POSTED: "Recruiter",
  PARTNER_POSTING: "Partner posting",
  ALUMNI_REFERRAL: "Alumni referral",
  JOB_API: "Job API",
  OTHER: "Other",
};

export interface JobSkillRequirement {
  skillId: string;
  requirementType: Requirement;
  weight: string | number;
  skill: { id: string; name: string; category: string | null };
}

export interface JobSourceInfo {
  sourceType: SourceType;
  sourceLabel: string | null;
  sourceUrl: string | null;
  importedAt: string;
}

export interface Job {
  id: string;
  title: string;
  description: string;
  location: string | null;
  workMode: WorkMode;
  employmentType: EmploymentType;
  minimumCgpa: string | number | null;
  applicationDeadline: string | null;
  externalUrl: string | null;
  status: JobStatus;
  origin: SourceType;
  sourceCount: number;
  parseMethod: "llm" | "rules" | null;
  createdAt: string;
  company: { id: string; name: string } | null;
  skillRequirements: JobSkillRequirement[];
  eligibleBranches: { branch: string }[];
  graduationYears: { graduationYear: number }[];
  sources?: JobSourceInfo[];
  /** Present on `GET /jobs?withFit=true` for a signed-in student. */
  fit?: FitBrief | null;
}

export const requiredSkills = (j: Pick<Job, "skillRequirements">) => j.skillRequirements.filter((r) => r.requirementType === "REQUIRED").map((r) => r.skill.name);
export const preferredSkills = (j: Pick<Job, "skillRequirements">) => j.skillRequirements.filter((r) => r.requirementType === "PREFERRED").map((r) => r.skill.name);

// ---- generated resume and claim check ------------------------------------------------------------

export interface ProofRef {
  kind: "assessment" | "github" | "resume" | "profile";
  label: string;
  url?: string;
}

export interface ResumeBullet {
  text: string;
  tier: "verified" | "self_reported";
  factIds: string[];
  proof: ProofRef[];
  relevance: number;
}

export interface BlockedClaim {
  claim: string;
  kind: "skill" | "project" | "project_technology" | "feature" | "responsibility" | "metric";
  reason: string;
  action: string;
}

export interface LedgerEntry {
  factId: string;
  text: string;
  status: "verified" | "self_reported" | "blocked" | "dropped_for_space";
  reason: string;
}

export interface GeneratedResume {
  job: { title: string; company: string | null };
  header: { name: string; email: string | null; github: string | null; linkedin: string | null };
  summary: ResumeBullet | null;
  skills: { skill: string; factId: string; combinedScore: number | null; proof: ProofRef[] }[];
  projects: { id: string; title: string; link: string | null; bullets: ResumeBullet[] }[];
  experience: { organization: string; title: string | null; dates: string | null; bullets: ResumeBullet[] }[];
  education: ResumeBullet | null;
  blocked: BlockedClaim[];
  ledger: LedgerEntry[];
  stats: { lines: number; maxLines: number; droppedForSpace: number };
}

export interface ResumeForJob {
  resume: GeneratedResume;
  /** A complete standalone HTML document of the one-page resume (render in an iframe with srcDoc). */
  html: string;
  fit: FitResult;
  jobId: string;
}

export type ClaimVerdict = "supported" | "partially_supported" | "self_reported" | "needs_review" | "unsupported" | "unverified";

export interface ClaimEntry {
  kind: "skill" | "project_technology" | "project_feature" | "experience_dates" | "experience_responsibility";
  claim: string;
  where: string;
  verdict: ClaimVerdict;
  flagged: boolean;
  reason: string;
  proof: string[];
}

export interface ClaimSummary {
  supported: number;
  partially_supported: number;
  self_reported: number;
  needs_review: number;
  unsupported: number;
  unverified: number;
  total: number;
  flagged: number;
}

export interface ClaimCheck {
  resumeId: string;
  checkedAt: string;
  entries: ClaimEntry[];
  summary: ClaimSummary;
}

// ---- applications --------------------------------------------------------------------------------

export interface ApplicationEvent {
  id: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  note: string | null;
  createdAt: string;
  actor?: { name: string | null; role: string } | null;
}
