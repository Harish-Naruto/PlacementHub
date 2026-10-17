import React, { useState } from "react";
import { btnGhost, input } from "./ui";

/** Edits a list of skill names as removable chips. Names are normalised on the server when saved. */
export const ChipEditor: React.FC<{ label: string; values: string[]; onChange: (next: string[]) => void; disabled?: boolean }> = ({ label, values, onChange, disabled }) => {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setDraft("");
  };

  return (
    <div>
      <p className="text-xs font-bold text-slate-600 mb-1">{label}</p>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-6">
        {values.length === 0 && <span className="text-[11px] text-slate-400">None yet</span>}
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800">
            {v}
            <button type="button" disabled={disabled} onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`} className="w-4 h-4 rounded-full hover:bg-emerald-200 text-emerald-700 leading-none">
              x
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add a skill"
          className={input}
        />
        <button type="button" disabled={disabled || !draft.trim()} onClick={add} className={btnGhost}>
          Add
        </button>
      </div>
    </div>
  );
};
