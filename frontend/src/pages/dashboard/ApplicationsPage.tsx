import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { errorMessage, fetchMyApplications, withdrawApplication, type Application } from "../../api/match";
import { STATUS_LABEL, stageOf, type ApplicationStatus } from "../../api/types";
import { FitBadge } from "../../components/common/FitBadge";
import { Empty, ErrorBox, Loading, PageHeader } from "../../components/common/Feedback";
import { Notice } from "../../components/student/Chip";
import { useAsync } from "../../components/student/useAsync";

const STEPS = ["Applied", "Interview", "Offer"] as const;

const StageTracker: React.FC<{ status: ApplicationStatus }> = ({ status }) => {
  const stage = stageOf(status);
  const closed = stage === "Closed";
  const current = closed ? -1 : STEPS.indexOf(stage as (typeof STEPS)[number]);
  return (
    <div className="space-y-2">
      <ol className="flex items-center" aria-label="Application stage">
        {STEPS.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={s} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black border-2 ${
                    active ? "bg-blue-600 border-blue-600 text-white" : done ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-slate-300 text-slate-400"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span className={`text-[11px] font-bold ${active ? "text-blue-700" : done ? "text-emerald-700" : "text-slate-400"}`}>{s}</span>
              </div>
              {i < STEPS.length - 1 && <span className={`flex-1 h-0.5 mx-2 mb-4 ${done ? "bg-emerald-500" : "bg-slate-200"}`} />}
            </li>
          );
        })}
      </ol>
      {closed && (
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${status === "REJECTED" ? "bg-rose-100 text-rose-800" : "bg-slate-200 text-slate-700"}`}>
          Closed: {STATUS_LABEL[status]}
        </span>
      )}
      {!closed && <p className="text-xs text-slate-600">Now: {STATUS_LABEL[status]}</p>}
    </div>
  );
};

const ApplicationCard: React.FC<{ app: Application; onWithdraw: (id: string) => void; busy: boolean }> = ({ app, onWithdraw, busy }) => {
  const canWithdraw = !["WITHDRAWN", "HIRED", "REJECTED"].includes(app.status);
  const events = app.events ?? [];
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-slate-900">{app.jobPosting?.title ?? "Role application"}</h3>
          <p className="text-xs font-semibold text-slate-600">{app.jobPosting?.company?.name ?? "Hiring partner"}</p>
          <p className="text-xs text-slate-500 mt-0.5">Applied on {new Date(app.appliedAt).toLocaleDateString()}</p>
        </div>
        <div className="flex items-center gap-2">
          {app.jobPosting && (
            <Link to={`/dashboard/jobs/${app.jobPosting.id}`} className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-xl">
              View job
            </Link>
          )}
          {canWithdraw && (
            <button
              onClick={() => onWithdraw(app.id)}
              disabled={busy}
              className="px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl disabled:opacity-50"
            >
              {busy ? "Withdrawing..." : "Withdraw"}
            </button>
          )}
        </div>
      </div>

      <StageTracker status={app.status} />

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500">Fit when you applied</span>
          <FitBadge score={app.fitScore} band={app.fitSnapshot?.band} />
          {app.fitSnapshot && app.fitSnapshot.requiredTotal > 0 && (
            <span className="text-xs text-slate-500">
              {app.fitSnapshot.requiredDemonstrated} of {app.fitSnapshot.requiredTotal} required skills demonstrated
            </span>
          )}
        </div>
        {app.fitSnapshot?.explanation && (
          <details>
            <summary className="text-xs font-bold text-blue-600 cursor-pointer">Why this score</summary>
            <p className="text-xs text-slate-700 leading-relaxed mt-1">{app.fitSnapshot.explanation}</p>
          </details>
        )}
      </div>

      {events.length > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-500 mb-2">Timeline</p>
          <ol className="border-l-2 border-slate-200 ml-1.5 space-y-3">
            {[...events].reverse().map((ev) => (
              <li key={ev.id} className="pl-4 relative">
                <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-white border-2 border-blue-500" />
                <p className="text-xs font-bold text-slate-900">
                  {STATUS_LABEL[ev.toStatus] ?? ev.toStatus}
                  <span className="font-normal text-slate-500"> · {new Date(ev.createdAt).toLocaleDateString()}</span>
                  {ev.actor?.role && <span className="font-normal text-slate-500"> · by {ev.actor.role.toLowerCase()}</span>}
                </p>
                {ev.note && <p className="text-xs text-slate-600">{ev.note}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

export const ApplicationsPage: React.FC = () => {
  const { accessToken } = useAuth();
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsync(async () => {
    if (!accessToken) throw new Error("Please sign in again.");
    return fetchMyApplications(accessToken);
  }, "apps");
  const applications = data ?? [];

  const handleWithdraw = async (appId: string) => {
    if (!accessToken) return;
    if (!window.confirm("Are you sure you want to withdraw this application?")) return;
    setWithdrawingId(appId);
    setActionError(null);
    try {
      await withdrawApplication(accessToken, appId);
      reload();
    } catch (e) {
      setActionError(errorMessage(e, "Failed to withdraw application."));
    } finally {
      setWithdrawingId(null);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <PageHeader title="My applications" subtitle="Where each application stands, and how it scored when you applied." />
      {actionError && <Notice tone="error">{actionError}</Notice>}
      <ErrorBox message={error ? errorMessage(error, "Could not load applications.") : null} onRetry={reload} />
      {loading ? (
        <Loading label="Loading applications..." />
      ) : applications.length === 0 && !error ? (
        <Empty title="No applications yet" hint="Find an opening that fits your skills and apply to track it here.">
          <Link to="/dashboard/jobs" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold">
            Browse openings
          </Link>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {applications.map((app) => (
            <ApplicationCard key={app.id} app={app} onWithdraw={(id) => void handleWithdraw(id)} busy={withdrawingId === app.id} />
          ))}
        </div>
      )}
    </div>
  );
};
