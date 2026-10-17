import React, { useState } from "react";
import { allowedNext, STATUS_LABEL } from "../../api/types";
import type { ApplicationStatus } from "../../api/types";
import { DANGER_BTN, errorMessage, INPUT_CLS, SECONDARY_BTN } from "./helpers";

interface StatusControlsProps {
  status: ApplicationStatus;
  /** Performs the change; throw to show the server message. */
  onChange: (to: ApplicationStatus, note: string) => Promise<void>;
  /** Drawer layout: shows an always-visible note field and bigger buttons. */
  expanded?: boolean;
}

/** The valid next statuses for one application. Picking one asks for an optional note, then confirms. */
export const StatusControls: React.FC<StatusControlsProps> = ({ status, onChange, expanded = false }) => {
  const [pending, setPending] = useState<ApplicationStatus | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = allowedNext(status);
  if (next.length === 0) return <span className="text-[11px] text-slate-400">No further steps</span>;

  const forward = next.filter((s) => s !== "REJECTED");
  const primary = forward[0];
  const later = forward.slice(1);

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await onChange(pending, note.trim());
      setPending(null);
      setNote("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const choose = (s: ApplicationStatus) => {
    setPending(s);
    setError(null);
  };

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-1.5">
        {primary && (
          <button disabled={busy} onClick={() => choose(primary)} className="px-2.5 py-1 rounded-lg bg-purple-600 text-white text-[11px] font-bold hover:bg-purple-700 disabled:opacity-50">
            {STATUS_LABEL[primary]}
          </button>
        )}
        {later.length > 0 && (
          <select
            aria-label="Move to another status"
            value=""
            disabled={busy}
            onChange={(e) => e.target.value && choose(e.target.value as ApplicationStatus)}
            className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-700"
          >
            <option value="">Skip to...</option>
            {later.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        )}
        {next.includes("REJECTED") && (
          <button disabled={busy} onClick={() => choose("REJECTED")} className={`${DANGER_BTN} !px-2.5 !py-1 !text-[11px]`}>
            Reject
          </button>
        )}
      </div>

      {(pending || expanded) && (
        <div className="space-y-2">
          {pending && <p className="text-[11px] font-semibold text-slate-700">Move to {STATUS_LABEL[pending]}</p>}
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            placeholder="Optional note for the history"
            className={INPUT_CLS}
            disabled={busy || !pending}
          />
          {pending && (
            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={confirm}
                className={pending === "REJECTED" ? "px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-50" : "px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 disabled:opacity-50"}
              >
                {busy ? "Saving..." : "Confirm"}
              </button>
              <button disabled={busy} onClick={() => setPending(null)} className={SECONDARY_BTN}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-[11px] font-semibold text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
};
