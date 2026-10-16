import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchJobs, applyToJob, type JobData } from "../api/student";

export const PublicJobsPage: React.FC = () => {
  const { user, accessToken } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchJobs(accessToken || "")
      .then(setJobs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  const handleApply = async (jobId: string) => {
    if (!user) {
      navigate("/signin");
      return;
    }
    if (!accessToken) return;
    setApplyingId(jobId);
    setMessage(null);
    try {
      await applyToJob(accessToken, jobId);
      setMessage({ type: "success", text: "Application submitted successfully! Track it in your Dashboard." });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to apply." });
    } finally {
      setApplyingId(null);
    }
  };

  const filteredJobs = jobs.filter(
    (j) =>
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.description.toLowerCase().includes(search.toLowerCase()) ||
      (j.recruiterProfile?.company?.name || "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Campus Job Board</h1>
        <p className="text-sm text-slate-500 mt-1">Explore verified opportunities posted by registered campus recruitment partners.</p>
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

      {/* Search Bar */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">🔍</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by job title, company, or keywords..."
          className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Jobs List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading campus openings...</div>
      ) : filteredJobs.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80">
          <p className="text-base font-bold text-slate-700">No matching jobs found right now</p>
          <p className="text-xs text-slate-400 mt-1">Campus recruiters publish new roles regularly. Check back soon!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">{job.title}</h3>
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

              <div className="flex md:flex-col items-center md:items-end justify-between gap-3">
                <button
                  onClick={() => handleApply(job.id)}
                  disabled={applyingId === job.id}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition disabled:opacity-50 whitespace-nowrap"
                >
                  {applyingId === job.id ? "Submitting..." : user ? "Apply Now" : "Sign In to Apply"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
