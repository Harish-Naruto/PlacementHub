import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  fetchJobApplications,
  updateApplicationStatusApi,
  fetchApplicationEvents,
  type CandidateApplication,
  type ApplicationStatus,
  type ApplicationEventItem,
} from "../../api/recruiter";

const STATUS_OPTIONS: { label: string; value: ApplicationStatus; color: string }[] = [
  { label: "Applied", value: "APPLIED", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { label: "In Review", value: "IN_REVIEW", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { label: "Shortlisted", value: "SHORTLISTED", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { label: "Interview Scheduled", value: "INTERVIEW_SCHEDULED", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { label: "Interviewing", value: "INTERVIEWING", color: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  { label: "Offered", value: "OFFERED", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { label: "Hired", value: "HIRED", color: "bg-emerald-600 text-white border-emerald-600" },
  { label: "Rejected", value: "REJECTED", color: "bg-rose-100 text-rose-800 border-rose-200" },
];

export const JobApplicantsPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const { accessToken } = useAuth();

  const [jobTitle, setJobTitle] = useState<string>("Job Opening");
  const [applications, setApplications] = useState<CandidateApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Status Modal State
  const [activeApp, setActiveApp] = useState<CandidateApplication | null>(null);
  const [newStatus, setNewStatus] = useState<ApplicationStatus>("IN_REVIEW");
  const [statusNote, setStatusNote] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Events Timeline Modal State
  const [viewingEventsApp, setViewingEventsApp] = useState<CandidateApplication | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<ApplicationEventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const loadApplicants = useCallback(async () => {
    if (!accessToken || !jobId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchJobApplications(accessToken, jobId, {
        status: selectedStatus || undefined,
        limit: 50,
      });
      setJobTitle(data.job?.title || "Job Opening");
      setApplications(data.applications);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load candidate applications.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, jobId, selectedStatus]);

  useEffect(() => {
    loadApplicants();
  }, [loadApplicants]);

  const handleOpenStatusModal = (app: CandidateApplication) => {
    setActiveApp(app);
    setNewStatus(app.status);
    setStatusNote("");
  };

  const handleSaveStatus = async () => {
    if (!accessToken || !activeApp) return;
    setUpdatingStatus(true);
    try {
      await updateApplicationStatusApi(accessToken, activeApp.id, {
        status: newStatus,
        note: statusNote.trim() || undefined,
      });
      setActiveApp(null);
      loadApplicants();
    } catch (err: any) {
      alert(err.message || "Failed to update status.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleOpenTimeline = async (app: CandidateApplication) => {
    if (!accessToken) return;
    setViewingEventsApp(app);
    setLoadingEvents(true);
    try {
      const events = await fetchApplicationEvents(accessToken, app.id);
      setTimelineEvents(events);
    } catch (err: any) {
      alert(err.message || "Failed to load timeline.");
      setViewingEventsApp(null);
    } finally {
      setLoadingEvents(false);
    }
  };

  // Pipeline Counts
  const counts = {
    all: applications.length,
    applied: applications.filter((a) => a.status === "APPLIED").length,
    inReview: applications.filter((a) => a.status === "IN_REVIEW").length,
    shortlisted: applications.filter((a) => a.status === "SHORTLISTED").length,
    interviewing: applications.filter((a) =>
      ["INTERVIEW_SCHEDULED", "INTERVIEWING"].includes(a.status),
    ).length,
    hired: applications.filter((a) => ["OFFERED", "HIRED"].includes(a.status)).length,
    rejected: applications.filter((a) => a.status === "REJECTED").length,
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/dashboard/recruiter/jobs"
              className="text-xs font-bold text-purple-600 hover:underline"
            >
              ← All Postings
            </Link>
            <span className="text-xs text-slate-400">/</span>
            <span className="text-xs text-slate-500 font-semibold truncate max-w-xs">
              {jobTitle}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Candidate Pipeline: {jobTitle}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Evaluate applicants, review candidate credentials, and advance candidates through recruitment stages.
          </p>
        </div>

        <Link
          to={`/dashboard/recruiter/jobs`}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
        >
          <span>Back to Jobs</span>
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

      {/* Summary Pipeline Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: "All Applicants", count: counts.all, filter: "" },
          { label: "Applied", count: counts.applied, filter: "APPLIED" },
          { label: "In Review", count: counts.inReview, filter: "IN_REVIEW" },
          { label: "Shortlisted", count: counts.shortlisted, filter: "SHORTLISTED" },
          { label: "Interviewing", count: counts.interviewing, filter: "INTERVIEWING" },
          { label: "Offered / Hired", count: counts.hired, filter: "HIRED" },
        ].map((item) => {
          const isActive = selectedStatus === item.filter;
          return (
            <button
              key={item.label}
              onClick={() => setSelectedStatus(item.filter)}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                isActive
                  ? "bg-purple-600 border-purple-600 text-white shadow-sm shadow-purple-500/20"
                  : "bg-white border-slate-200/80 hover:border-slate-300 text-slate-900"
              }`}
            >
              <div
                className={`text-2xl font-black tracking-tight ${
                  isActive ? "text-white" : "text-slate-900"
                }`}
              >
                {item.count}
              </div>
              <div
                className={`text-[11px] font-bold mt-0.5 ${
                  isActive ? "text-purple-100" : "text-slate-500"
                }`}
              >
                {item.label}
              </div>
            </button>
          );
        })}
      </div>

      {/* Candidates List */}
      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">Loading applicants...</div>
      ) : applications.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-slate-900">No applicants in this view</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {selectedStatus
              ? `No candidates currently have the "${selectedStatus}" status.`
              : "Students have not applied to this position yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => {
            const student = app.studentProfile;
            const user = student.user;
            const currentBadge =
              STATUS_OPTIONS.find((s) => s.value === app.status)?.color ||
              "bg-slate-100 text-slate-700";

            return (
              <div
                key={app.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs hover:border-slate-300 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6"
              >
                {/* Candidate Overview */}
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                    {user.name ? user.name[0].toUpperCase() : "S"}
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {user.name || "Student Candidate"}
                      </h3>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${currentBadge}`}
                      >
                        {app.status.replace("_", " ")}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>✉️ {user.email}</span>
                      {student.institution && (
                        <span>🏛️ {student.institution.name}</span>
                      )}
                      {student.branch && (
                        <span>🎓 {student.branch}</span>
                      )}
                      {student.graduationYear && (
                        <span>📅 Batch {student.graduationYear}</span>
                      )}
                      {student.cgpa && (
                        <span className="font-bold text-purple-700">
                          ⭐ CGPA: {student.cgpa}
                        </span>
                      )}
                    </div>

                    {/* Skills pills */}
                    {student.skills && student.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {student.skills.slice(0, 6).map((sk, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-slate-50 border border-slate-200 text-slate-700"
                          >
                            {sk.skill.name}
                          </span>
                        ))}
                        {student.skills.length > 6 && (
                          <span className="text-[10px] text-slate-400 font-semibold px-1">
                            +{student.skills.length - 6} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status & Actions Column */}
                <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                  {app.resumeUrl && (
                    <a
                      href={app.resumeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>Resume</span>
                    </a>
                  )}

                  <button
                    onClick={() => handleOpenTimeline(app)}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                  >
                    Timeline
                  </button>

                  <button
                    onClick={() => handleOpenStatusModal(app)}
                    className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition shadow-xs flex items-center gap-1.5"
                  >
                    <span>Change Stage</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stage Change Modal */}
      {activeApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-slate-900">
              Update Candidate Stage
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Transition candidate <strong>{activeApp.studentProfile.user.name}</strong> to the next recruitment milestone.
            </p>

            <div className="my-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Target Stage
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as ApplicationStatus)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-hidden"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Optional Audit Note
                </label>
                <textarea
                  rows={3}
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="e.g. Cleared technical round 1 with high score, schedule final interview."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setActiveApp(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingStatus}
                onClick={handleSaveStatus}
                className="px-5 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition shadow-xs disabled:opacity-50"
              >
                {updatingStatus ? "Updating..." : "Save Transition"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Events Timeline Modal */}
      {viewingEventsApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Status Transition Timeline
                </h3>
                <p className="text-xs text-slate-500">
                  {viewingEventsApp.studentProfile.user.name} ({viewingEventsApp.studentProfile.user.email})
                </p>
              </div>
              <button
                onClick={() => setViewingEventsApp(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {loadingEvents ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading timeline...</div>
              ) : timelineEvents.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">No events recorded.</div>
              ) : (
                timelineEvents.map((evt, i) => (
                  <div key={evt.id || i} className="flex items-start gap-3 text-xs">
                    <div className="w-2 h-2 rounded-full bg-purple-600 mt-1.5 shrink-0"></div>
                    <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">
                          {evt.toStatus.replace("_", " ")}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(evt.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {evt.note && (
                        <p className="text-slate-600 mt-1 text-[11px] leading-relaxed">
                          {evt.note}
                        </p>
                      )}
                      {evt.actor && (
                        <span className="inline-block mt-1 text-[10px] text-purple-700 font-medium">
                          By: {evt.actor.name || evt.actor.email} ({evt.actor.role})
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewingEventsApp(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
