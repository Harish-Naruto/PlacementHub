import React from "react";
import type { GapKind, JobStatus, Requirement } from "../../api/types";
import { GAP_COPY, label } from "./ui";

export const SkillChip: React.FC<{ name: string; tone?: "required" | "preferred" | "matched" | "neutral"; title?: string }> = ({ name, tone = "neutral", title }) => {
  const style = {
    required: "bg-emerald-50 text-emerald-800 border-emerald-200",
    preferred: "bg-slate-50 text-slate-700 border-slate-200",
    matched: "bg-emerald-50 text-emerald-800 border-emerald-200",
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
  }[tone];
  return (
    <span title={title} className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold ${style}`}>
      {name}
    </span>
  );
};

export const SkillChips: React.FC<{ names: string[]; tone?: "required" | "preferred"; empty?: string }> = ({ names, tone = "required", empty = "None" }) =>
  names.length === 0 ? <span className="text-[11px] text-slate-400">{empty}</span> : (
    <span className="inline-flex flex-wrap gap-1">
      {names.map((n) => (
        <SkillChip key={n} name={n} tone={tone} />
      ))}
    </span>
  );

/** A gap: required gaps stand out in rose, claimed-only skills are dashed amber with an explanation. */
export const GapChip: React.FC<{ skill: string; requirement: Requirement; kind: GapKind; detail?: string }> = ({ skill, requirement, kind, detail }) => {
  const claimed = kind === "claimed_only";
  const style = claimed
    ? "bg-amber-50 text-amber-800 border-dashed border-amber-400"
    : requirement === "REQUIRED"
      ? "bg-rose-50 text-rose-800 border-rose-300 font-bold"
      : "bg-slate-50 text-slate-600 border-slate-200";
  return (
    <span title={`${requirement === "REQUIRED" ? "Required" : "Preferred"}: ${claimed ? "claimed, no evidence yet" : (detail ?? GAP_COPY[kind])}`} className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold ${style}`}>
      {skill}
    </span>
  );
};

const JOB_STATUS_STYLE: Record<JobStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PUBLISHED: "bg-emerald-100 text-emerald-800",
  PAUSED: "bg-amber-100 text-amber-800",
  CLOSED: "bg-rose-100 text-rose-800",
};

export const JobStatusBadge: React.FC<{ status: JobStatus }> = ({ status }) => (
  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${JOB_STATUS_STYLE[status]}`}>{status.charAt(0) + status.slice(1).toLowerCase()}</span>
);

export const Field: React.FC<{ label: string; htmlFor?: string; children: React.ReactNode; hint?: string }> = ({ label: text, htmlFor, children, hint }) => (
  <div>
    <label htmlFor={htmlFor} className={label}>
      {text}
    </label>
    {children}
    {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
  </div>
);

export const ParseBadge: React.FC<{ method: string | null | undefined }> = ({ method }) =>
  method ? (
    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">{method === "llm" ? "Parsed by AI" : "Parsed by rules"}</span>
  ) : null;
