import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  getMyJobs,
  getRecruiterProfile,
  publishJob,
  pauseJob,
  closeJob,
  type JobPosting,
  type RecruiterProfileData,
} from "../../api/recruiter";

interface OverviewProps {
  onNavigate: (view: "jobs" | "post-job" | "job-detail", jobId?: string) => void;
  onOpenProfile: () => void;
}

const statusColor: Record<string, string> = {
  DRAFT: "bg-slate-700/60 text-slate-300 border-slate-600/40",
  PUBLISHED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  PAUSED: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  CLOSED: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export const RecruiterOverview: React.FC<OverviewProps> = ({ onNavigate, onOpenProfile }) => {
  const { user, accessToken } = useAuth();
  const [profile, setProfile] = useState<RecruiterProfileData | null>(null);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const refresh = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [profileData, jobsData] = await Promise.all([
        getRecruiterProfile(accessToken).catch(() => null),
        getMyJobs(accessToken, { limit: 5 }).catch(() => ({ jobs: [], total: 0, page: 1, totalPages: 0 })),
      ]);
      setProfile(profileData);
      setJobs(jobsData?.jobs ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [accessToken]);

  const handlePublish = async (jobId: string) => {
    if (!accessToken) return;
    setActionLoading(jobId);
    try { await publishJob(accessToken, jobId); await refresh(); } finally { setActionLoading(null); }
  };

  const handlePause = async (jobId: string) => {
    if (!accessToken) return;
    setActionLoading(jobId);
    try { await pauseJob(accessToken, jobId); await refresh(); } finally { setActionLoading(null); }
  };

  const handleClose = async (jobId: string) => {
    if (!accessToken) return;
    setActionLoading(jobId);
    try { await closeJob(accessToken, jobId); await refresh(); } finally { setActionLoading(null); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const published = jobs.filter((j) => j.status === "PUBLISHED").length;
  const drafts = jobs.filter((j) => j.status === "DRAFT").length;
  const totalApplications = jobs.reduce((s, j) => s + (j._count?.applications ?? 0), 0);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-extrabold text-white">
          {profile?.company?.name
            ? `${profile.company.name} Dashboard`
            : `Welcome, ${user?.name || "Recruiter"}!`}
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {profile?.company?.name
            ? `Managing recruitment for ${profile.company.name}`
            : "Complete your company profile to start posting jobs and hiring candidates."}
        </p>
      </div>

      {/* Profile incomplete banner */}
      {!profile?.company && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-indigo-500/15 to-purple-500/15 border border-indigo-500/30 shadow-lg shadow-indigo-500/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-2xl shrink-0">
              🏢
            </div>
            <div>
              <p className="text-sm font-bold text-white">Complete your company profile</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Add your company name, location, and details before publishing job openings.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenProfile}
            className="px-5 py-2.5 text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl shadow-md shadow-indigo-500/25 transition cursor-pointer self-start sm:self-auto shrink-0"
          >
            Set Up Profile →
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Jobs", value: jobs.length, icon: "💼", gradient: "from-indigo-500/20 to-purple-500/20 border-indigo-500/30" },
          { label: "Published", value: published, icon: "✅", gradient: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30" },
          { label: "Drafts", value: drafts, icon: "📋", gradient: "from-amber-500/20 to-orange-500/20 border-amber-500/30" },
          { label: "Applications", value: totalApplications, icon: "👥", gradient: "from-sky-500/20 to-blue-500/20 border-sky-500/30" },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`p-5 rounded-2xl bg-gradient-to-br ${stat.gradient} border backdrop-blur-sm`}
          >
            <div className="text-2xl mb-2">{stat.icon}</div>
            <div className="text-3xl font-black text-white">{stat.value}</div>
            <div className="text-xs text-slate-400 font-medium mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Recent jobs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white">Recent Job Postings</h2>
          <button
            onClick={() => onNavigate("jobs")}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition"
          >
            View all →
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="text-center py-14 rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-sm font-semibold text-slate-300">No job postings yet</p>
            <p className="text-xs text-slate-500 mt-1">Create your first job opening to start hiring.</p>
            <button
              onClick={() => onNavigate("post-job")}
              className="mt-4 px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25 transition hover:opacity-90"
            >
              Post a Job
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="group flex items-center gap-4 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.07] hover:border-white/10 transition-all duration-200 cursor-pointer"
                onClick={() => onNavigate("job-detail", job.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <p className="text-sm font-semibold text-white truncate">{job.title}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor[job.status]}`}>
                      {job.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                    {job.location && <span>📍 {job.location}</span>}
                    <span>🗒 {job.employmentType.replace("_", " ")}</span>
                    <span>👥 {job._count?.applications ?? 0} applicants</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {job.status === "DRAFT" && (
                    <button
                      disabled={actionLoading === job.id}
                      onClick={() => handlePublish(job.id)}
                      className="px-3 py-1.5 text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded-lg hover:bg-emerald-600/30 transition disabled:opacity-50"
                    >
                      Publish
                    </button>
                  )}
                  {job.status === "PAUSED" && (
                    <>
                      <button
                        disabled={actionLoading === job.id}
                        onClick={() => handlePublish(job.id)}
                        className="px-3 py-1.5 text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded-lg hover:bg-emerald-600/30 transition disabled:opacity-50"
                      >
                        Resume
                      </button>
                      <button
                        disabled={actionLoading === job.id}
                        onClick={() => handleClose(job.id)}
                        className="px-3 py-1.5 text-xs font-semibold bg-rose-600/20 text-rose-300 border border-rose-500/30 rounded-lg hover:bg-rose-600/30 transition disabled:opacity-50"
                      >
                        Close
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
                        Pause
                      </button>
                      <button
                        disabled={actionLoading === job.id}
                        onClick={() => handleClose(job.id)}
                        className="px-3 py-1.5 text-xs font-semibold bg-rose-600/20 text-rose-300 border border-rose-500/30 rounded-lg hover:bg-rose-600/30 transition disabled:opacity-50"
                      >
                        Close
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
