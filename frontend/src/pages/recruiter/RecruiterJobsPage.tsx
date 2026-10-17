import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  fetchRecruiterJobs,
  publishRecruiterJob,
  pauseRecruiterJob,
  closeRecruiterJob,
  type RecruiterJob,
} from "../../api/recruiter";

export const RecruiterJobsPage: React.FC = () => {
  const { accessToken } = useAuth();

  const [jobs, setJobs] = useState<RecruiterJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchRecruiterJobs(accessToken, {
        status: statusFilter || undefined,
        limit: 50,
      });
      setJobs(data.jobs);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load job postings.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, statusFilter]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const handlePublish = async (jobId: string) => {
    if (!accessToken) return;
    try {
      await publishRecruiterJob(accessToken, jobId);
      loadJobs();
    } catch (err: any) {
      alert(err.message || "Failed to publish job");
    }
  };

  const handlePause = async (jobId: string) => {
    if (!accessToken) return;
    try {
      await pauseRecruiterJob(accessToken, jobId);
      loadJobs();
    } catch (err: any) {
      alert(err.message || "Failed to pause job");
    }
  };

  const handleClose = async (jobId: string) => {
    if (!accessToken || !window.confirm("Are you sure you want to close this job posting?")) return;
    try {
      await closeRecruiterJob(accessToken, jobId);
      loadJobs();
    } catch (err: any) {
      alert(err.message || "Failed to close job");
    }
  };

  const tabs = [
    { label: "All Postings", value: "" },
    { label: "Published", value: "PUBLISHED" },
    { label: "Drafts", value: "DRAFT" },
    { label: "Paused", value: "PAUSED" },
    { label: "Closed", value: "CLOSED" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Manage Job Postings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review your openings, track active student candidate applications, and control job visibility.
          </p>
        </div>

        <Link
          to="/dashboard/recruiter/jobs/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-500/20 hover:bg-purple-700 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          <span>Post New Job</span>
        </Link>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="font-bold hover:underline">
            ✕
          </button>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setStatusFilter(t.value)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              statusFilter === t.value
                ? "bg-purple-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Jobs List */}
      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">Loading job postings...</div>
      ) : jobs.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-slate-900">No job postings found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto mb-4">
            {statusFilter
              ? `You don't have any jobs matching the "${statusFilter}" status filter.`
              : "Get started by publishing your first campus job opportunity for students."}
          </p>
          <Link
            to="/dashboard/recruiter/jobs/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl hover:bg-purple-700 transition shadow-sm"
          >
            Create Job Now
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {jobs.map((job) => {
            const appCount = job._count?.applications ?? 0;
            const statusBadgeColor =
              job.status === "PUBLISHED"
                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                : job.status === "DRAFT"
                ? "bg-slate-100 text-slate-700 border-slate-200"
                : job.status === "PAUSED"
                ? "bg-amber-100 text-amber-800 border-amber-200"
                : "bg-rose-100 text-rose-800 border-rose-200";

            return (
              <div
                key={job.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                {/* Info Block */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${statusBadgeColor}`}
                    >
                      {job.status}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      {job.workMode}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700">
                      {job.employmentType.replace("_", " ")}
                    </span>
                    {job.location && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        📍 {job.location}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    {job.title}
                  </h3>

                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {job.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                    <span>
                      Created: <strong>{new Date(job.createdAt).toLocaleDateString()}</strong>
                    </span>
                    {job.applicationDeadline && (
                      <span>
                        Deadline:{" "}
                        <strong className="text-purple-700">
                          {new Date(job.applicationDeadline).toLocaleDateString()}
                        </strong>
                      </span>
                    )}
                    {job.minimumCgpa && (
                      <span>
                        Min CGPA: <strong>{job.minimumCgpa}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Metrics & Actions */}
                <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch sm:items-center gap-3 shrink-0">
                  {/* Candidates Badge */}
                  <Link
                    to={`/dashboard/recruiter/jobs/${job.id}/applicants`}
                    className="p-3 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-100 transition text-center group"
                  >
                    <div className="text-xl font-black text-purple-900 group-hover:scale-105 transition">
                      {appCount}
                    </div>
                    <div className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider mt-0.5">
                      Candidates
                    </div>
                  </Link>

                  {/* Lifecycle Controls */}
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    <Link
                      to={`/dashboard/recruiter/jobs/${job.id}/applicants`}
                      className="px-3.5 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition shadow-xs text-center"
                    >
                      View Pipeline
                    </Link>

                    {job.status === "DRAFT" && (
                      <button
                        onClick={() => handlePublish(job.id)}
                        className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 transition"
                      >
                        Publish
                      </button>
                    )}

                    {job.status === "PUBLISHED" && (
                      <button
                        onClick={() => handlePause(job.id)}
                        className="px-3 py-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold hover:bg-amber-100 transition"
                      >
                        Pause
                      </button>
                    )}

                    {job.status === "PAUSED" && (
                      <button
                        onClick={() => handlePublish(job.id)}
                        className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 transition"
                      >
                        Resume
                      </button>
                    )}

                    {job.status !== "CLOSED" && (
                      <button
                        onClick={() => handleClose(job.id)}
                        className="px-3 py-2 rounded-xl bg-slate-50 text-slate-600 border border-slate-200 text-xs font-bold hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition"
                      >
                        Close
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
