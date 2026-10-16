import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  getJobById,
  getJobApplications,
  publishJob,
  pauseJob,
  closeJob,
  getApplication,
  updateApplicationStatus,
  getApplicationEvents,
  type JobPosting,
  type ApplicationSummary,
  type ApplicationDetail,
  type ApplicationEvent,
} from "../../api/recruiter";

interface JobDetailProps {
  jobId: string;
  onBack: () => void;
}

const statusColor: Record<string, string> = {
  DRAFT: "bg-slate-700/60 text-slate-300 border-slate-600/40",
  PUBLISHED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  PAUSED: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  CLOSED: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const appStatusColor: Record<string, string> = {
  APPLIED: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  IN_REVIEW: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  SHORTLISTED: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  INTERVIEW_SCHEDULED: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  INTERVIEWING: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  OFFERED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  HIRED: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  REJECTED: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  WITHDRAWN: "bg-slate-700/60 text-slate-400 border-slate-600/40",
};

const NEXT_STATUSES: Record<string, string[]> = {
  APPLIED: ["IN_REVIEW", "REJECTED"],
  IN_REVIEW: ["SHORTLISTED", "REJECTED"],
  SHORTLISTED: ["INTERVIEW_SCHEDULED", "REJECTED"],
  INTERVIEW_SCHEDULED: ["INTERVIEWING", "REJECTED"],
  INTERVIEWING: ["OFFERED", "REJECTED"],
  OFFERED: ["HIRED", "REJECTED"],
};

// ─── Application drawer ───────────────────────────────────────────────────────

const ApplicationDrawer: React.FC<{
  applicationId: string;
  onClose: () => void;
  onStatusUpdated: () => void;
}> = ({ applicationId, onClose, onStatusUpdated }) => {
  const { accessToken } = useAuth();
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [events, setEvents] = useState<ApplicationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [note, setNote] = useState("");
  const [tab, setTab] = useState<"profile" | "history">("profile");

  useEffect(() => {
    if (!accessToken) return;
    Promise.all([
      getApplication(accessToken, applicationId),
      getApplicationEvents(accessToken, applicationId),
    ])
      .then(([d, ev]) => { setDetail(d); setEvents(ev); })
      .finally(() => setLoading(false));
  }, [accessToken, applicationId]);

  const handleStatusUpdate = async (newStatus: string) => {
    if (!accessToken || !detail) return;
    setUpdatingStatus(true);
    try {
      await updateApplicationStatus(accessToken, applicationId, newStatus, note.trim() || undefined);
      const [d, ev] = await Promise.all([
        getApplication(accessToken, applicationId),
        getApplicationEvents(accessToken, applicationId),
      ]);
      setDetail(d);
      setEvents(ev);
      setNote("");
      onStatusUpdated();
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-[#14142a] border-l border-white/[0.08] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/[0.07]">
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.07] transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-sm font-bold text-white flex-1">Application Review</h2>
          {detail && (
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${appStatusColor[detail.status]}`}>
              {detail.status.replace(/_/g, " ")}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : detail ? (
          <>
            {/* Candidate summary */}
            <div className="px-6 py-4 border-b border-white/[0.07] bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-base font-bold text-white shrink-0">
                  {(detail.studentProfile.user.name ?? detail.studentProfile.user.email).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    {detail.studentProfile.user.name ?? "Anonymous"}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{detail.studentProfile.user.email}</p>
                </div>
                {detail.resumeUrl && (
                  <a
                    href={detail.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs font-semibold bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 rounded-lg hover:bg-indigo-600/30 transition"
                  >
                    Resume ↗
                  </a>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-slate-500">
                {detail.studentProfile.branch && <span>🎓 {detail.studentProfile.branch}</span>}
                {detail.studentProfile.degree && <span>📚 {detail.studentProfile.degree}</span>}
                {detail.studentProfile.graduationYear && <span>🗓 {detail.studentProfile.graduationYear}</span>}
                {detail.studentProfile.cgpa && <span>📊 CGPA {detail.studentProfile.cgpa}</span>}
                {"institution" in detail.studentProfile && (
                  <span>🏛 {(detail.studentProfile as ApplicationDetail["studentProfile"]).institution.name}</span>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-4 py-3 border-b border-white/[0.07]">
              {(["profile", "history"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    tab === t
                      ? "bg-indigo-600/25 text-indigo-300 border border-indigo-500/30"
                      : "text-slate-500 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  {t === "profile" ? "Candidate Profile" : "Activity History"}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {tab === "profile" ? (
                <>
                  {/* Skills */}
                  {"skills" in detail.studentProfile && detail.studentProfile.skills.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(detail.studentProfile as ApplicationDetail["studentProfile"]).skills.map((s, i) => (
                          <span
                            key={i}
                            className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${
                              s.verificationStatus === "EVALUATED"
                                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                : "bg-white/[0.06] text-slate-400 border-white/10"
                            }`}
                          >
                            {s.skill.name}
                            {s.declaredLevel && <span className="text-slate-600 ml-1">· {s.declaredLevel}</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Projects */}
                  {"projects" in detail.studentProfile && detail.studentProfile.projects.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">Projects</p>
                      <div className="space-y-2.5">
                        {(detail.studentProfile as ApplicationDetail["studentProfile"]).projects.map((p) => (
                          <div key={p.id} className="p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-white">{p.title}</p>
                              <span className="text-[10px] text-slate-600">{p.status}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.description}</p>
                            <div className="flex gap-2 mt-2">
                              {p.repositoryUrl && (
                                <a href={p.repositoryUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300 transition">
                                  GitHub ↗
                                </a>
                              )}
                              {p.demoUrl && (
                                <a href={p.demoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 hover:text-emerald-300 transition">
                                  Demo ↗
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* External links */}
                  <div className="flex gap-2">
                    {"githubUsername" in detail.studentProfile && detail.studentProfile.githubUsername && (
                      <a
                        href={`https://github.com/${(detail.studentProfile as ApplicationDetail["studentProfile"]).githubUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.07] text-xs text-slate-400 hover:text-white transition"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                        </svg>
                        GitHub
                      </a>
                    )}
                    {"linkedinUrl" in detail.studentProfile && detail.studentProfile.linkedinUrl && (
                      <a
                        href={(detail.studentProfile as ApplicationDetail["studentProfile"]).linkedinUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.07] text-xs text-slate-400 hover:text-white transition"
                      >
                        LinkedIn ↗
                      </a>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  {events.length === 0 ? (
                    <p className="text-xs text-slate-600 text-center py-8">No activity yet</p>
                  ) : (
                    events.map((ev, i) => (
                      <div key={ev.id} className="relative pl-5">
                        {i < events.length - 1 && (
                          <div className="absolute left-[7px] top-6 w-0.5 h-full bg-white/[0.06]" />
                        )}
                        <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full bg-indigo-500/30 border border-indigo-500/50" />
                        <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.07]">
                          <div className="flex items-center gap-2 flex-wrap">
                            {ev.fromStatus && (
                              <>
                                <span className="text-xs text-slate-500">{ev.fromStatus.replace(/_/g, " ")}</span>
                                <span className="text-slate-600">→</span>
                              </>
                            )}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${appStatusColor[ev.toStatus]}`}>
                              {ev.toStatus.replace(/_/g, " ")}
                            </span>
                          </div>
                          {ev.note && <p className="text-xs text-slate-500 mt-1.5 italic">"{ev.note}"</p>}
                          <p className="text-[10px] text-slate-600 mt-1.5">
                            by {ev.actor.name ?? ev.actor.email} · {new Date(ev.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Status actions */}
            {NEXT_STATUSES[detail.status] && (
              <div className="px-6 py-4 border-t border-white/[0.07] bg-white/[0.02] space-y-3">
                <p className="text-xs font-semibold text-slate-400">Update Status</p>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note (visible in history)..."
                  className="w-full bg-white/[0.05] border border-white/10 text-white placeholder-slate-600 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition"
                />
                <div className="flex gap-2 flex-wrap">
                  {NEXT_STATUSES[detail.status].map((s) => (
                    <button
                      key={s}
                      disabled={updatingStatus}
                      onClick={() => handleStatusUpdate(s)}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg border transition disabled:opacity-50 ${
                        s === "REJECTED"
                          ? "bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25"
                          : "bg-indigo-500/15 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/25"
                      }`}
                    >
                      {updatingStatus ? "..." : `→ ${s.replace(/_/g, " ")}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
            Application not found.
          </div>
        )}
      </div>
    </>
  );
};

// ─── Job Detail page ──────────────────────────────────────────────────────────

export const RecruiterJobDetail: React.FC<JobDetailProps> = ({ jobId, onBack }) => {
  const { accessToken } = useAuth();
  const [job, setJob] = useState<JobPosting | null>(null);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [appTotal, setAppTotal] = useState(0);
  const [appPage, setAppPage] = useState(1);
  const [appTotalPages, setAppTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  const load = async (p = 1, sf = statusFilter) => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [jobData, appsData] = await Promise.all([
        getJobById(accessToken, jobId),
        getJobApplications(accessToken, jobId, {
          status: sf === "ALL" ? undefined : sf,
          page: p,
          limit: 10,
        }),
      ]);
      setJob(jobData);
      setApplications(appsData.applications);
      setAppTotal(appsData.total);
      setAppPage(appsData.page);
      setAppTotalPages(appsData.totalPages);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1, statusFilter); }, [accessToken, jobId, statusFilter]);

  const handlePublish = async () => {
    if (!accessToken || !job) return;
    setActionLoading(true);
    try { await publishJob(accessToken, job.id); await load(); } finally { setActionLoading(false); }
  };

  const handlePause = async () => {
    if (!accessToken || !job) return;
    setActionLoading(true);
    try { await pauseJob(accessToken, job.id); await load(); } finally { setActionLoading(false); }
  };

  const handleClose = async () => {
    if (!accessToken || !job) return;
    setActionLoading(true);
    try { await closeJob(accessToken, job.id); await load(); } finally { setActionLoading(false); }
  };

  const APP_STATUS_FILTERS = ["ALL", "APPLIED", "IN_REVIEW", "SHORTLISTED", "INTERVIEW_SCHEDULED", "INTERVIEWING", "OFFERED", "HIRED", "REJECTED"];

  if (loading && !job) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Jobs
      </button>

      {job && (
        <>
          {/* Job header */}
          <div className="p-6 rounded-2xl bg-white/[0.04] border border-white/[0.07]">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl font-extrabold text-white">{job.title}</h1>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusColor[job.status]}`}>
                    {job.status}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs text-slate-500">
                  {job.location && <span>📍 {job.location}</span>}
                  <span>🔀 {job.workMode}</span>
                  <span>🗒 {job.employmentType.replace("_", " ")}</span>
                  {job.minimumCgpa && <span>📊 Min CGPA: {job.minimumCgpa}</span>}
                  {job.applicationDeadline && (
                    <span>⏰ Deadline: {new Date(job.applicationDeadline).toLocaleDateString()}</span>
                  )}
                </div>

                <p className="text-sm text-slate-400 mt-4 leading-relaxed">{job.description}</p>

                {/* Skills */}
                {job.skillRequirements && job.skillRequirements.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {job.skillRequirements.map((sr, i) => (
                      <span
                        key={i}
                        className={`text-xs px-2.5 py-1 rounded-lg border ${
                          sr.requirementType === "REQUIRED"
                            ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                            : "bg-white/[0.05] text-slate-400 border-white/10"
                        }`}
                      >
                        {sr.skill.name}
                        {sr.requirementType === "PREFERRED" && <span className="text-slate-600 ml-1">(preferred)</span>}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 shrink-0">
                {job.status === "DRAFT" && (
                  <button
                    disabled={actionLoading}
                    onClick={handlePublish}
                    className="px-4 py-2 text-sm font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded-xl hover:bg-emerald-600/30 transition disabled:opacity-50"
                  >
                    Publish
                  </button>
                )}
                {job.status === "PAUSED" && (
                  <>
                    <button
                      disabled={actionLoading}
                      onClick={handlePublish}
                      className="px-4 py-2 text-sm font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded-xl hover:bg-emerald-600/30 transition disabled:opacity-50"
                    >
                      Resume Job
                    </button>
                    <button
                      disabled={actionLoading}
                      onClick={handleClose}
                      className="px-4 py-2 text-sm font-semibold bg-rose-600/20 text-rose-300 border border-rose-500/30 rounded-xl hover:bg-rose-600/30 transition disabled:opacity-50"
                    >
                      Close Job
                    </button>
                  </>
                )}
                {job.status === "PUBLISHED" && (
                  <>
                    <button
                      disabled={actionLoading}
                      onClick={handlePause}
                      className="px-4 py-2 text-sm font-semibold bg-amber-600/20 text-amber-300 border border-amber-500/30 rounded-xl hover:bg-amber-600/30 transition disabled:opacity-50"
                    >
                      Pause Job
                    </button>
                    <button
                      disabled={actionLoading}
                      onClick={handleClose}
                      className="px-4 py-2 text-sm font-semibold bg-rose-600/20 text-rose-300 border border-rose-500/30 rounded-xl hover:bg-rose-600/30 transition disabled:opacity-50"
                    >
                      Close Job
                    </button>
                  </>
                )}
                {job.externalUrl && (
                  <a
                    href={job.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 text-sm font-semibold bg-white/[0.06] text-slate-300 border border-white/10 rounded-xl hover:bg-white/[0.09] transition"
                  >
                    External ↗
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Applications section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white">
                Applications <span className="text-slate-500 font-normal text-sm">({appTotal})</span>
              </h2>
            </div>

            {/* Filter pills - horizontal scroll */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none">
              {APP_STATUS_FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`whitespace-nowrap px-3 py-1.5 text-[11px] font-semibold rounded-xl border transition-all flex-shrink-0 ${
                    statusFilter === f
                      ? "bg-indigo-600/30 text-indigo-300 border-indigo-500/40"
                      : "bg-white/[0.04] text-slate-500 border-white/[0.07] hover:text-white hover:bg-white/[0.07]"
                  }`}
                >
                  {f === "ALL" ? "All" : f.replace(/_/g, " ")}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : applications.length === 0 ? (
              <div className="text-center py-12 rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
                <div className="text-3xl mb-2">👥</div>
                <p className="text-sm text-slate-400">No applications yet</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.06] hover:border-white/10 transition-all duration-200 cursor-pointer"
                    onClick={() => setSelectedAppId(app.id)}
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/40 to-purple-600/40 border border-indigo-500/20 flex items-center justify-center text-sm font-bold text-indigo-300 shrink-0">
                      {(app.studentProfile.user.name ?? app.studentProfile.user.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {app.studentProfile.user.name ?? "Anonymous"}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                        {app.studentProfile.branch && <span>{app.studentProfile.branch}</span>}
                        {app.studentProfile.cgpa && <span>CGPA {app.studentProfile.cgpa}</span>}
                        <span>Applied {new Date(app.appliedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${appStatusColor[app.status]}`}>
                        {app.status.replace(/_/g, " ")}
                      </span>
                      <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {appTotalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  disabled={appPage <= 1}
                  onClick={() => load(appPage - 1)}
                  className="px-4 py-2 text-sm font-semibold text-slate-400 bg-white/[0.04] border border-white/[0.07] rounded-xl disabled:opacity-40 hover:text-white hover:bg-white/[0.07] transition"
                >
                  ← Prev
                </button>
                <span className="text-xs text-slate-500">
                  Page {appPage} of {appTotalPages}
                </span>
                <button
                  disabled={appPage >= appTotalPages}
                  onClick={() => load(appPage + 1)}
                  className="px-4 py-2 text-sm font-semibold text-slate-400 bg-white/[0.04] border border-white/[0.07] rounded-xl disabled:opacity-40 hover:text-white hover:bg-white/[0.07] transition"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Application drawer */}
      {selectedAppId && (
        <ApplicationDrawer
          applicationId={selectedAppId}
          onClose={() => setSelectedAppId(null)}
          onStatusUpdated={() => load(appPage)}
        />
      )}
    </div>
  );
};
