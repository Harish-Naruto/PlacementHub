import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  fetchRecruiterProfile,
  fetchRecruiterJobs,
  type RecruiterProfile,
  type RecruiterJob,
} from "../../api/recruiter";

export const RecruiterOverviewPage: React.FC = () => {
  const { user, accessToken } = useAuth();

  const [profile, setProfile] = useState<RecruiterProfile | null>(null);
  const [jobs, setJobs] = useState<RecruiterJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!accessToken) return;
      setLoading(true);
      try {
        const [profData, jobsData] = await Promise.all([
          fetchRecruiterProfile(accessToken).catch(() => null),
          fetchRecruiterJobs(accessToken, { limit: 10 }).catch(() => ({ jobs: [], total: 0 })),
        ]);
        setProfile(profData);
        setJobs(jobsData.jobs || []);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [accessToken]);

  const totalJobs = jobs.length;
  const activeJobs = jobs.filter((j) => j.status === "PUBLISHED").length;
  const totalApplications = jobs.reduce((acc, j) => acc + (j._count?.applications || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-purple-500/20 to-transparent pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-200 text-xs font-bold uppercase tracking-wider">
              <span>Recruiter Hub</span>
              <span>•</span>
              <span>{profile?.company?.name || "Corporate Partner"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Welcome back, {user?.name || "Hiring Partner"}!
            </h1>
            <p className="text-xs sm:text-sm text-purple-200/80 leading-relaxed">
              Manage your campus job openings, review student applicants, and advance candidates through your hiring pipeline.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/dashboard/recruiter/jobs/new"
              className="px-5 py-3 rounded-xl bg-white text-purple-900 font-extrabold text-xs uppercase tracking-wider shadow-lg hover:bg-purple-50 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span>Post a Job</span>
            </Link>
            <Link
              to="/dashboard/recruiter/company"
              className="px-4 py-3 rounded-xl bg-purple-800/60 hover:bg-purple-800 border border-purple-700/60 text-white font-bold text-xs transition"
            >
              Edit Profile
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Job Postings
            </div>
            <div className="text-3xl font-black text-slate-900 mt-1">
              {loading ? "..." : totalJobs}
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            💼
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Active / Published
            </div>
            <div className="text-3xl font-black text-emerald-600 mt-1">
              {loading ? "..." : activeJobs}
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            🟢
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Applicants
            </div>
            <div className="text-3xl font-black text-indigo-600 mt-1">
              {loading ? "..." : totalApplications}
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            👥
          </div>
        </div>
      </div>

      {/* Recent Job Postings */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Job Postings</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live campus listings and applicant activity.
            </p>
          </div>
          <Link
            to="/dashboard/recruiter/jobs"
            className="text-xs font-bold text-purple-600 hover:underline"
          >
            View All ({jobs.length}) →
          </Link>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading jobs...</div>
        ) : jobs.length === 0 ? (
          <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6">
            <h3 className="text-sm font-bold text-slate-800">No active job postings</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Create your first job listing to start receiving qualified student applications.
            </p>
            <Link
              to="/dashboard/recruiter/jobs/new"
              className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 transition shadow-xs"
            >
              Post a Job Now
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {jobs.slice(0, 5).map((job) => (
              <div
                key={job.id}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">{job.title}</h4>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        job.status === "PUBLISHED"
                          ? "bg-emerald-100 text-emerald-800"
                          : job.status === "DRAFT"
                          ? "bg-slate-100 text-slate-700"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-3 mt-1">
                    <span>{job.workMode}</span>
                    <span>•</span>
                    <span>{job.employmentType.replace("_", " ")}</span>
                    {job.location && (
                      <>
                        <span>•</span>
                        <span>{job.location}</span>
                      </>
                    )}
                    <span>•</span>
                    <span>Posted {new Date(job.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs font-bold text-purple-700">
                      {job._count?.applications ?? 0}
                    </span>
                    <span className="text-xs text-slate-400"> applicants</span>
                  </div>
                  <Link
                    to={`/dashboard/recruiter/jobs/${job.id}/applicants`}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold transition border border-purple-200/60"
                  >
                    Pipeline →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
