import React, { useState } from "react";
import { Link } from "react-router-dom";
import { setRecruiterJobStatus } from "../../api/recruiterPortal";
import type { Job, JobStatus } from "../../api/types";
import { useAuth } from "../../context/AuthContext";
import { DANGER_BTN, errorMessage, JOB_STATUS_LABEL, JOB_STATUS_STYLE, SECONDARY_BTN } from "./helpers";

export const ProfileRequiredBox: React.FC = () => (
  <div className="bg-purple-50 border border-purple-200 rounded-2xl p-6 text-center">
    <p className="text-sm font-bold text-purple-900">Set up your company profile first</p>
    <p className="text-xs text-purple-800/80 mt-1">We need your company name before you can post jobs or see applicants.</p>
    <Link to="/recruiter/profile" className="inline-block mt-4 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700">
      Go to company profile
    </Link>
  </div>
);

export const JobStatusBadge: React.FC<{ status: JobStatus }> = ({ status }) => (
  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${JOB_STATUS_STYLE[status]}`}>{JOB_STATUS_LABEL[status]}</span>
);

export const SourcesBadge: React.FC<{ job: Pick<Job, "sourceCount" | "sources"> }> = ({ job }) => {
  if (job.sourceCount <= 1) return null;
  const labels = (job.sources ?? []).map((s) => s.sourceLabel || s.sourceType).join("\n");
  return (
    <span title={labels || undefined} className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 cursor-help">
      Seen from {job.sourceCount} sources
    </span>
  );
};

interface JobStatusActionsProps {
  job: Pick<Job, "id" | "status" | "title">;
  /** Called after a successful change so the caller can refetch. */
  onChanged: () => void;
  onError: (message: string) => void;
}

/** Publish / Pause / Close buttons that match what the server allows for the current status. */
export const JobStatusActions: React.FC<JobStatusActionsProps> = ({ job, onChanged, onError }) => {
  const { accessToken } = useAuth();
  const [busy, setBusy] = useState(false);

  const run = async (action: "publish" | "pause" | "close") => {
    if (!accessToken) return;
    if (action === "close" && !window.confirm(`Close "${job.title}"? A closed job cannot be reopened and stops accepting applications.`)) return;
    setBusy(true);
    try {
      await setRecruiterJobStatus(accessToken, job.id, action);
      onChanged();
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(job.status === "DRAFT" || job.status === "PAUSED") && (
        <button disabled={busy} onClick={() => run("publish")} className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 disabled:opacity-50">
          Publish
        </button>
      )}
      {job.status === "PUBLISHED" && (
        <button disabled={busy} onClick={() => run("pause")} className={SECONDARY_BTN}>
          Pause
        </button>
      )}
      {job.status !== "CLOSED" && (
        <button disabled={busy} onClick={() => run("close")} className={DANGER_BTN}>
          Close
        </button>
      )}
    </div>
  );
};
