import { ApiRequestError } from "../../api/http";
import type { JobStatus } from "../../api/types";

export const errorMessage = (err: unknown, fallback = "Something went wrong. Please try again."): string => (err instanceof Error && err.message ? err.message : fallback);

export const isProfileRequired = (err: unknown): boolean => err instanceof ApiRequestError && err.code === "RECRUITER_PROFILE_REQUIRED";

export const JOB_STATUS_STYLE: Record<JobStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PUBLISHED: "bg-emerald-100 text-emerald-800",
  PAUSED: "bg-amber-100 text-amber-800",
  CLOSED: "bg-rose-100 text-rose-800",
};

export const JOB_STATUS_LABEL: Record<JobStatus, string> = { DRAFT: "Draft", PUBLISHED: "Published", PAUSED: "Paused", CLOSED: "Closed" };

export const WORK_MODE_LABEL = { ONSITE: "On-site", HYBRID: "Hybrid", REMOTE: "Remote" } as const;
export const EMPLOYMENT_LABEL = { FULL_TIME: "Full time", INTERNSHIP: "Internship", CONTRACT: "Contract", PART_TIME: "Part time" } as const;

/** ISO timestamp -> value for a date input, in the viewer's own time zone. */
export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Date input value -> ISO timestamp at the end of that local day (empty -> null). */
export const fromDateInput = (value: string): string | null => (value ? new Date(`${value}T23:59:59`).toISOString() : null);

export const GAP_COPY = {
  missing: "not on the profile",
  claimed_only: "claimed, no evidence yet",
  weak: "assessed below the pass mark",
  observed_only: "seen in GitHub code, never assessed",
} as const;

export const INPUT_CLS = "w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400";
export const LABEL_CLS = "block text-xs font-bold text-slate-700 mb-1";
export const PRIMARY_BTN = "px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition";
export const SECONDARY_BTN = "px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition";
export const DANGER_BTN = "px-3 py-1.5 rounded-xl bg-white border border-rose-300 text-rose-700 text-xs font-bold hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed transition";
