import React, { useState } from "react";
import { INPUT_CLS, LABEL_CLS } from "./helpers";

const TONE = {
  slate: "bg-slate-100 text-slate-800 border-slate-200",
  purple: "bg-purple-50 text-purple-800 border-purple-200",
  blue: "bg-blue-50 text-blue-800 border-blue-200",
} as const;

interface ChipEditorProps {
  label: string;
  hint?: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  tone?: keyof typeof TONE;
  /** When set, each chip gets a small button that hands the chip to the caller (e.g. move to another list). */
  moveLabel?: string;
  onMove?: (value: string) => void;
}

/** A list of chips: type and press Enter (or comma) to add, click x to remove. */
export const ChipEditor: React.FC<ChipEditorProps> = ({ label, hint, values, onChange, placeholder = "Type and press Enter", tone = "slate", moveLabel, onMove }) => {
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const items = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (!items.length) return;
    const next = [...values];
    for (const item of items) if (!next.some((v) => v.toLowerCase() === item.toLowerCase())) next.push(item);
    onChange(next);
    setDraft("");
  };

  return (
    <div>
      <label className={LABEL_CLS}>{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[1.5rem]">
        {values.length === 0 && <span className="text-[11px] text-slate-400">None yet</span>}
        {values.map((v) => (
          <span key={v} className={`inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full border text-[11px] font-semibold ${TONE[tone]}`}>
            {v}
            {onMove && moveLabel && (
              <button type="button" onClick={() => onMove(v)} title={moveLabel} className="px-1 rounded text-[10px] font-bold opacity-70 hover:opacity-100 hover:bg-white/60">
                {moveLabel}
              </button>
            )}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`} className="w-4 h-4 leading-none rounded-full hover:bg-white/70 font-bold">
              x
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            }
          }}
          onBlur={() => add(draft)}
          placeholder={placeholder}
          className={INPUT_CLS}
        />
      </div>
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
};

interface SkillListsEditorProps {
  required: string[];
  preferred: string[];
  onChange: (next: { required: string[]; preferred: string[] }) => void;
}

const without = (list: string[], skill: string) => list.filter((s) => s.toLowerCase() !== skill.toLowerCase());

/** Required and preferred skills as two chip lists. A skill lives in one list only; arrows move it across. */
export const SkillListsEditor: React.FC<SkillListsEditorProps> = ({ required, preferred, onChange }) => (
  <div className="grid sm:grid-cols-2 gap-4">
    <ChipEditor
      label="Required skills"
      hint="Candidates are ranked mostly on these. At least one is needed to publish."
      values={required}
      tone="purple"
      onChange={(req) => onChange({ required: req, preferred: preferred.filter((p) => !req.some((r) => r.toLowerCase() === p.toLowerCase())) })}
      moveLabel="→ preferred"
      onMove={(s) => onChange({ required: without(required, s), preferred: [...preferred, s] })}
    />
    <ChipEditor
      label="Preferred skills"
      hint="Nice to have. They add to the fit but are not required."
      values={preferred}
      tone="blue"
      onChange={(pre) => onChange({ preferred: pre, required: required.filter((r) => !pre.some((p) => p.toLowerCase() === r.toLowerCase())) })}
      moveLabel="→ required"
      onMove={(s) => onChange({ preferred: without(preferred, s), required: [...required, s] })}
    />
  </div>
);
