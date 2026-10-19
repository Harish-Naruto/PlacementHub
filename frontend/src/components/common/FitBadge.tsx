import React from "react";
import type { FitBand } from "../../api/types";

const STYLE: Record<FitBand, string> = {
  Strong: "bg-emerald-50 text-emerald-800 border-emerald-300",
  Good: "bg-blue-50 text-blue-800 border-blue-300",
  Partial: "bg-amber-50 text-amber-800 border-amber-300",
  Low: "bg-rose-50 text-rose-800 border-rose-300",
  Unknown: "bg-slate-50 text-slate-600 border-slate-300",
};

/** Fit score with its band, e.g. "82 · Strong". A null score means the opening lists no skills. */
export const FitBadge: React.FC<{ score: number | null | undefined; band?: FitBand; className?: string }> = ({ score, band, className = "" }) => {
  const b: FitBand = band ?? (score == null ? "Unknown" : score >= 70 ? "Strong" : score >= 50 ? "Good" : score >= 30 ? "Partial" : "Low");
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${STYLE[b]} ${className}`} title="Evidence-backed fit">
      <span>{score == null ? "–" : score}</span>
      <span className="opacity-60">·</span>
      <span>{b}</span>
    </span>
  );
};

/** A thin bar for lists and tables. */
export const FitBar: React.FC<{ score: number | null | undefined }> = ({ score }) => (
  <div className="w-24 h-2 rounded-full bg-slate-100 overflow-hidden" aria-hidden>
    <div className={`h-full ${score == null ? "bg-slate-300" : score >= 70 ? "bg-emerald-500" : score >= 50 ? "bg-blue-500" : score >= 30 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${score ?? 0}%` }} />
  </div>
);
