import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { fetchApplications, withdrawApplicationApi, type ApplicationData } from "../../api/student";
import { StatusBadge } from "../../components/common/StatusBadge";

export const ApplicationsPage: React.FC = () => {
  const { accessToken } = useAuth();
  const [applications, setApplications] = useState<ApplicationData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    fetchApplications(accessToken)
      .then(setApplications)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  const handleWithdraw = async (appId: string) => {
    if (!accessToken) return;
    const confirm = window.confirm("Are you sure you want to withdraw this application?");
    if (!confirm) return;

    try {
      await withdrawApplicationApi(accessToken, appId);
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: "WITHDRAWN" } : a)),
      );
    } catch (err: any) {
      alert(err.message || "Failed to withdraw application.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Application Tracker</h2>
        <p className="text-xs text-slate-500 mt-1">Live updates on reviews, interview invites, and company selections.</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading applications...</div>
      ) : applications.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80">
          <p className="text-base font-bold text-slate-700">No applications submitted yet</p>
          <p className="text-xs text-slate-400 mt-1">Browse open campus positions and apply to track updates here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {applications.map((app) => (
            <div
              key={app.id}
              className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base font-bold text-slate-900">{app.jobPosting?.title || "Role Application"}</h3>
                  <StatusBadge status={app.status} type="application" />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Submitted on {new Date(app.appliedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                </p>
                {app.events && app.events.length > 0 && (
                  <div className="mt-2 text-[11px] text-slate-400">
                    Latest event: <span className="text-slate-600 font-semibold">{app.events[app.events.length - 1].toStatus}</span>
                  </div>
                )}
              </div>

              {app.status !== "WITHDRAWN" && !["HIRED", "REJECTED"].includes(app.status) && (
                <button
                  onClick={() => handleWithdraw(app.id)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition self-start sm:self-auto"
                >
                  Withdraw
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
