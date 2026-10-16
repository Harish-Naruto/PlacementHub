import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  getMyJobs,
  publishJob,
  pauseJob,
  closeJob,
  type JobPosting,
} from "../../api/recruiter";

interface JobListProps {
  onNavigate: (view: "post-job" | "job-detail", jobId?: string) => void;
}

const statusColor: Record<string, string> = {
  DRAFT: "bg-slate-700/60 text-slate-300 border-slate-600/40",
  PUBLISHED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  PAUSED: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  CLOSED: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const workModeIcon: Record<string, string> = {
  ONSITE: "🏢",
  HYBRID: "🔀",
  REMOTE: "🌐",
};

const empTypeLabel: Record<string, string> = {
  FULL_TIME: "Full-time",
  INTERNSHIP: "Internship",
  CONTRACT: "Contract",
  PART_TIME: "Part-time",
};

const STATUS_FILTERS = ["ALL", "DRAFT", "PUBLISHED", "PAUSED", "CLOSED"] as const;

export const RecruiterJobList: React.FC<JobListProps> = ({ onNavigate }) => {
  const { accessToken } = useAuth();
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async (p = 1, status = statusFilter) => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getMyJobs(accessToken, {
        status: status === "ALL" ? undefined : status,
        page: p,
        limit: 10,
      });
      setJobs(res.jobs);
      setTotal(res.total);
      setPage(res.page);
      setTotalPages(res.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1, statusFilter); }, [accessToken, statusFilter]);

  const handlePublish = async (jobId: string) => {
    if (!accessToken) return;
    setActionLoading(jobId);
    try { await publishJob(accessToken, jobId); await load(page); } finally { setActionLoading(null); }
  };

  const handlePause = async (jobId: string) => {
    if (!accessToken) return;
    setActionLoading(jobId);
    try { await pauseJob(accessToken, jobId); await load(page); } finally { setActionLoading(null); }
  };

  const handleClose = async (jobId: string) => {
    if (!accessToken) return;
    setActionLoading(jobId);
    try { await closeJob(accessToken, jobId); await load(page); } finally { setActionLoading(null); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-white">My Job Postings</h1>
          <p className="text-sm text-slate-400 mt-0.5">{total} total job{total !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => onNavigate("post-job")}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 rounded-xl shadow-lg shadow-indigo-500/25 transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Post New Job
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1.5 p-1 bg-white/[0.04] border border-white/[0.07] rounded-2xl w-fit flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-xl transition-all duration-200 ${
              statusFilter === f
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
            }`}
          >
            {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{error}</div>
      )}

      {/* Jobs */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-sm font-semibold text-slate-300">No jobs found</p>
          <p className="text-xs text-slate-500 mt-1">
            {statusFilter === "ALL" ? "Post your first job to get started." : `No ${statusFilter.toLowerCase()} jobs.`}
          </p>
          {statusFilter === "ALL" && (
            <button
              onClick={() => onNavigate("post-job")}
              className="mt-4 px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25 transition hover:opacity-90"
            >
              Post a Job
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="group p-5 rounded-2xl bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.06] hover:border-white/10 transition-all duration-200 cursor-pointer"
              onClick={() => onNavigate("job-detail", job.id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-sm font-bold text-white">{job.title}</h3>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusColor[job.status]}`}>
                      {job.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                    {job.location && <span>📍 {job.location}</span>}
                    <span>{workModeIcon[job.workMode]} {job.workMode}</span>
                    <span>🗒 {empTypeLabel[job.employmentType]}</span>
                    {job.applicationDeadline && (
                      <span>⏰ Deadline: {new Date(job.applicationDeadline).toLocaleDateString()}</span>
                    )}
                    <span className="text-indigo-400 font-medium">
                      👥 {job._count?.applications ?? 0} applicant{(job._count?.applications ?? 0) !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 mt-2 line-clamp-2">{job.description}</p>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <span className="text-xs text-slate-600">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {job.status === "DRAFT" && (
                      <button
                        disabled={actionLoading === job.id}
                        onClick={() => handlePublish(job.id)}
                        className="px-3 py-1.5 text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded-lg hover:bg-emerald-600/30 transition disabled:opacity-50"
                      >
                        {actionLoading === job.id ? "..." : "Publish"}
                      </button>
                    )}
                    {job.status === "PAUSED" && (
                      <>
                        <button
                          disabled={actionLoading === job.id}
                          onClick={() => handlePublish(job.id)}
                          className="px-3 py-1.5 text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded-lg hover:bg-emerald-600/30 transition disabled:opacity-50"
                        >
                          {actionLoading === job.id ? "..." : "Resume"}
                        </button>
                        <button
                          disabled={actionLoading === job.id}
                          onClick={() => handleClose(job.id)}
                          className="px-3 py-1.5 text-xs font-semibold bg-rose-600/20 text-rose-300 border border-rose-500/30 rounded-lg hover:bg-rose-600/30 transition disabled:opacity-50"
                        >
                          {actionLoading === job.id ? "..." : "Close"}
                        </button>
                      </>
                    )}
                    {job.status === "PUBLISHED" && (
                      <>
                        <button
                          disabled={actionLoading === job.id}
                          onClick={() => handlePause(job.id)}
                          className="px-3 py-1.5 text-xs font-semibold bg-amber-600/20 text-amber-300 border border-amber-500/30 rounded-lg hover:bg-amber-600/30 transition disabled:opacity-50"
                        >
                          {actionLoading === job.id ? "..." : "Pause"}
                        </button>
                        <button
                          disabled={actionLoading === job.id}
                          onClick={() => handleClose(job.id)}
                          className="px-3 py-1.5 text-xs font-semibold bg-rose-600/20 text-rose-300 border border-rose-500/30 rounded-lg hover:bg-rose-600/30 transition disabled:opacity-50"
                        >
                          {actionLoading === job.id ? "..." : "Close"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => load(page - 1)}
            className="px-4 py-2 text-sm font-semibold text-slate-400 bg-white/[0.04] border border-white/[0.07] rounded-xl disabled:opacity-40 hover:text-white hover:bg-white/[0.07] transition"
          >
            ← Prev
          </button>
          <span className="text-xs text-slate-500">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => load(page + 1)}
            className="px-4 py-2 text-sm font-semibold text-slate-400 bg-white/[0.04] border border-white/[0.07] rounded-xl disabled:opacity-40 hover:text-white hover:bg-white/[0.07] transition"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};
