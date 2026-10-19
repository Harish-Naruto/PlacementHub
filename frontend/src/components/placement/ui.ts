import { useEffect, useState } from "react";

export const card = "bg-white rounded-2xl border border-slate-200 p-5";
export const label = "block text-xs font-bold text-slate-600 mb-1";
export const input =
  "w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500";
export const btnPrimary = "px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition";
export const btnGhost = "px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition";
export const btnDanger = "px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed transition";
export const th = "px-3 py-2 text-left text-[11px] font-bold text-slate-500 whitespace-nowrap";
export const td = "px-3 py-2.5 text-xs text-slate-700 align-top";

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Please try again.");

export const GAP_COPY = {
  missing: "not on the profile",
  claimed_only: "claimed, no evidence yet",
  weak: "assessed below the pass mark",
  observed_only: "seen in GitHub code, never assessed",
} as const;

/** Returns `value` after it has stopped changing for `ms`, so typing in a filter does not refetch on every key. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
