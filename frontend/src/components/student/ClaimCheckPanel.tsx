import React, { useState } from "react";
import { errorMessage, fetchClaimCheck } from "../../api/match";
import type { ClaimCheck, ClaimEntry, ClaimVerdict } from "../../api/types";
import { Chip, type ChipTone } from "./Chip";

const VERDICT: Record<ClaimVerdict, { label: string; tone: ChipTone }> = {
  supported: { label: "Supported", tone: "green" },
  partially_supported: { label: "Partially supported", tone: "blue" },
  self_reported: { label: "Self-reported", tone: "slate" },
  needs_review: { label: "Needs review", tone: "amber" },
  unsupported: { label: "Unsupported", tone: "rose" },
  unverified: { label: "Unverified", tone: "amber" },
};

const KIND_LABEL: Record<ClaimEntry["kind"], string> = {
  skill: "Skills",
  project_technology: "Project technologies",
  project_feature: "Project features",
  experience_dates: "Experience dates",
  experience_responsibility: "Experience responsibilities",
};

const SUMMARY_KEYS: ClaimVerdict[] = ["supported", "partially_supported", "self_reported", "needs_review", "unsupported", "unverified"];

/** "Check claims" button for one uploaded resume plus its expandable result. */
export const ClaimCheckPanel: React.FC<{ token: string | null; resumeId: string }> = ({ token, resumeId }) => {
  const [result, setResult] = useState<ClaimCheck | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!token) return;
    if (result) {
      setOpen((o) => !o);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResult(await fetchClaimCheck(token, resumeId));
      setOpen(true);
    } catch (e) {
      setError(errorMessage(e, "Could not check this resume."));
    } finally {
      setBusy(false);
    }
  };

  const kinds = result ? (Object.keys(KIND_LABEL) as ClaimEntry["kind"][]).filter((k) => result.entries.some((e) => e.kind === k)) : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => void run()} disabled={busy} className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold disabled:opacity-50">
          {busy ? "Checking..." : result ? (open ? "Hide claim check" : "Show claim check") : "Check claims"}
        </button>
        {error && <span className="text-xs font-semibold text-rose-700">{error}</span>}
      </div>

      {result && open && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {SUMMARY_KEYS.map((k) => (
              <Chip key={k} tone={result.summary[k] > 0 ? VERDICT[k].tone : "slate"}>
                {VERDICT[k].label}: {result.summary[k]}
              </Chip>
            ))}
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black border ${
                result.summary.flagged > 0 ? "bg-amber-100 text-amber-900 border-amber-400" : "bg-white text-slate-600 border-slate-200"
              }`}
            >
              Flagged: {result.summary.flagged} of {result.summary.total}
            </span>
          </div>
          <p className="text-xs text-slate-600">Unverified or unsupported means not backed by evidence yet, not that it is false. Take the assessment or link a GitHub project to back it.</p>

          {result.entries.length === 0 && <p className="text-xs text-slate-500">No claims were found in this resume.</p>}

          {kinds.map((k) => (
            <div key={k}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">{KIND_LABEL[k]}</p>
              <ul className="space-y-1.5">
                {result.entries
                  .filter((e) => e.kind === k)
                  .map((e, i) => (
                    <li key={`${e.claim}-${i}`} className={`p-2.5 rounded-xl border text-xs ${e.flagged ? "bg-amber-50 border-amber-300" : "bg-white border-slate-200"}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Chip tone={VERDICT[e.verdict].tone}>{VERDICT[e.verdict].label}</Chip>
                        <span className="font-bold text-slate-900 break-words min-w-0">{e.claim}</span>
                      </div>
                      <p className="text-slate-500 mt-1">{e.where}</p>
                      <p className="text-slate-700 mt-0.5">{e.reason}</p>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
