import React from "react";

const TONES = {
  green: "bg-emerald-50 text-emerald-800 border-emerald-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  rose: "bg-rose-50 text-rose-800 border-rose-200",
  blue: "bg-blue-50 text-blue-800 border-blue-200",
  slate: "bg-slate-100 text-slate-700 border-slate-200",
} as const;

export type ChipTone = keyof typeof TONES;

/** Small rounded label used for skills, statuses and counts. */
export const Chip: React.FC<{ tone?: ChipTone; children: React.ReactNode; title?: string }> = ({ tone = "slate", children, title }) => (
  <span title={title} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${TONES[tone]}`}>
    {children}
  </span>
);

export const Notice: React.FC<{ tone: "success" | "error" | "info"; children: React.ReactNode }> = ({ tone, children }) => (
  <div
    role={tone === "error" ? "alert" : "status"}
    className={`p-3 rounded-xl text-xs font-semibold border ${
      tone === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : tone === "error" ? "bg-rose-50 text-rose-800 border-rose-200" : "bg-blue-50 text-blue-800 border-blue-200"
    }`}
  >
    {children}
  </div>
);

export const Card: React.FC<{ title?: string; children: React.ReactNode; className?: string }> = ({ title, children, className = "" }) => (
  <section className={`bg-white rounded-2xl border border-slate-200 p-5 ${className}`}>
    {title && <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">{title}</h3>}
    {children}
  </section>
);
