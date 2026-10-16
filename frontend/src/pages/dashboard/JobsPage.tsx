import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { fetchJobs, applyToJob, fetchApplications, type JobData, type ApplicationData } from "../../api/student";

export const JobsPage: React.FC = () => {
  const { accessToken } = useAuth();
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [applications, setApplications] = useState<ApplicationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!accessToken) return;

    Promise.all([fetchJobs(accessToken), fetchApplications(accessToken)])
      .then(([j, a]) => {
        setJobs(j);
        setApplications(a);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  const handleApply = async (jobId: string) => {
    if (!accessToken) return;
    setApplyingId(jobId);
    setMessage(null);
    try {
      const app = await applyToJob(accessToken, jobId);
      setApplications((prev) => [app, ...prev]);
      setMessage({ type: "success", text: "Successfully applied to job! You can track status in Applications." });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to apply." });
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Campus Job Opportunities</h2>
        <p className="text-xs text-slate-500 mt-1">Direct recruitment pipelines with university partner companies.</p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading campus jobs...</div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80">
          <p className="text-base font-bold text-slate-700">No active job postings right now</p>
          <p className="text-xs text-slate-400 mt-1">Partner companies will post campus requirements soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {jobs.map((job) => {
            const isApplied = applications.some((a) => a.jobPosting?.id === job.id);
            return (
              <div
                key={job.id}
                className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">{job.title}</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      {job.employmentType}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                      {job.workMode}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-600">
                    🏢 {job.recruiterProfile?.company?.name || "Campus Hiring Partner"} • 📍 {job.location || "Remote"}
                  </p>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed max-w-2xl">
                    {job.description}
                  </p>
                </div>

                <div>
                  <button
                    onClick={() => handleApply(job.id)}
                    disabled={isApplied || applyingId === job.id}
                    className={`px-6 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                      isApplied
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
                    }`}
                  >
                    {isApplied ? "✓ Applied" : applyingId === job.id ? "Applying..." : "Apply Now"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
