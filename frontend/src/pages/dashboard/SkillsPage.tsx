import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  fetchStudentSkills,
  fetchStudentResumes,
  addStudentSkill,
  deleteStudentSkill,
  type StudentSkill,
  type ResumeItem,
} from "../../api/student";
import { StatusBadge } from "../../components/common/StatusBadge";

export const SkillsPage: React.FC = () => {
  const { accessToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialResumeId = searchParams.get("resumeId") || "ALL";

  const [skills, setSkills] = useState<StudentSkill[]>([]);
  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>(initialResumeId);
  const [loading, setLoading] = useState(true);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillLevel, setNewSkillLevel] = useState("INTERMEDIATE");
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "VERIFIED" | "UNVERIFIED">("ALL");

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);

    Promise.all([
      fetchStudentSkills(accessToken),
      fetchStudentResumes(accessToken),
    ])
      .then(([skillsData, resumesData]) => {
        setSkills(skillsData);
        setResumes(resumesData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  // Synchronize when URL query param changes
  useEffect(() => {
    const rId = searchParams.get("resumeId");
    if (rId && rId !== selectedResumeId) {
      setSelectedResumeId(rId);
    }
  }, [searchParams]);

  const handleSelectResume = (rId: string) => {
    setSelectedResumeId(rId);
    if (rId === "ALL") {
      searchParams.delete("resumeId");
      setSearchParams(searchParams);
    } else {
      setSearchParams({ resumeId: rId });
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !newSkillName.trim()) return;

    setSubmitting(true);
    try {
      const added = await addStudentSkill(accessToken, newSkillName.trim(), newSkillLevel);
      setSkills((prev) => [...prev, added]);
      setNewSkillName("");
    } catch (err: any) {
      alert(err.message || "Failed to add skill.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!accessToken) return;
    try {
      await deleteStudentSkill(accessToken, id);
      setSkills((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete skill.");
    }
  };

  // 1. Filter by selected Resume ID (if selected)
  const resumeFilteredSkills = skills.filter((s) => {
    if (selectedResumeId === "ALL") return true;
    return s.resumeIds && s.resumeIds.includes(selectedResumeId);
  });

  const verifiedCount = resumeFilteredSkills.filter(
    (s) => s.verificationStatus === "EVALUATED" || s.verificationStatus === "VERIFIED"
  ).length;
  const userMentionedCount = resumeFilteredSkills.length - verifiedCount;

  // 2. Filter by status (ALL / VERIFIED / UNVERIFIED)
  const displayedSkills = resumeFilteredSkills.filter((s) => {
    const isVerified = s.verificationStatus === "EVALUATED" || s.verificationStatus === "VERIFIED";
    if (statusFilter === "VERIFIED") return isVerified;
    if (statusFilter === "UNVERIFIED") return !isVerified;
    return true;
  });

  const activeResume = resumes.find((r) => r.id === selectedResumeId);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Technical Skills & Evidence</h2>
          <p className="text-xs text-slate-500 mt-1">
            Skills are isolated by your uploaded Resume ID so you can generate targeted assessments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-2xs">
            Showing: <span className="text-blue-600">{resumeFilteredSkills.length}</span>
          </div>
          <div className="px-3 py-1.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 shadow-2xs">
            Verified: <span>{verifiedCount}</span>
          </div>
          <div className="px-3 py-1.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800 shadow-2xs">
            User Mentioned: <span>{userMentionedCount}</span>
          </div>
        </div>
      </div>

      {/* Resume Selector Filter */}
      {resumes.length > 0 && (
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <span>📄</span> Filter Skills by Source Resume
            </span>
            <Link to="/dashboard/resume" className="text-xs font-bold text-blue-600 hover:underline">
              Manage Resumes ({resumes.length}) →
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleSelectResume("ALL")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                selectedResumeId === "ALL"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200/70"
              }`}
            >
              <span>📁</span> All Profile Skills ({skills.length})
            </button>

            {resumes.map((r, idx) => {
              const count = skills.filter((s) => s.resumeIds?.includes(r.id)).length;
              const isSelected = selectedResumeId === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => handleSelectResume(r.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                      : "bg-blue-50 text-blue-800 hover:bg-blue-100/70 border border-blue-200/60"
                  }`}
                >
                  <span>📄</span> Resume #{idx + 1}
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isSelected ? "bg-white/20 text-white" : "bg-blue-200/60 text-blue-900"}`}>
                    ID: {r.id.slice(0, 6)}...
                  </span>
                  <span className="text-[11px] opacity-80">({count} skills)</span>
                </button>
              );
            })}
          </div>

          {activeResume && (
            <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="font-bold text-blue-900">
                  Targeting Resume ID: <code className="font-mono bg-white px-2 py-0.5 rounded border border-blue-300">{activeResume.id}</code>
                </span>
                <p className="text-[11px] text-blue-700">
                  Uploaded on {new Date(activeResume.createdAt).toLocaleDateString()} • Generating assessments will focus only on these {resumeFilteredSkills.length} skills.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-white text-blue-700 font-bold rounded-xl border border-blue-300 shadow-2xs">
                  🎯 Assessment Ready
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Skill Form */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Add New Skill to Profile</label>
            <input
              type="text"
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
              placeholder="e.g. TypeScript, React, Docker, PostgreSQL"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="w-full sm:w-48">
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Proficiency Level</label>
            <select
              value={newSkillLevel}
              onChange={(e) => setNewSkillLevel(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
              <option value="EXPERT">Expert</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting || !newSkillName.trim()}
            className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-500/20 transition disabled:opacity-50 whitespace-nowrap"
          >
            {submitting ? "Adding..." : "+ Add Skill"}
          </button>
        </form>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setStatusFilter("ALL")}
          className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${
            statusFilter === "ALL"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
          }`}
        >
          All ({resumeFilteredSkills.length})
        </button>
        <button
          onClick={() => setStatusFilter("VERIFIED")}
          className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${
            statusFilter === "VERIFIED"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100/80"
          }`}
        >
          Verified ({verifiedCount})
        </button>
        <button
          onClick={() => setStatusFilter("UNVERIFIED")}
          className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${
            statusFilter === "UNVERIFIED"
              ? "bg-amber-600 text-white shadow-sm"
              : "bg-amber-50 text-amber-800 hover:bg-amber-100/80"
          }`}
        >
          Mentioned by User ({userMentionedCount})
        </button>
      </div>

      {/* Skills Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading skills...</div>
      ) : displayedSkills.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80">
          <p className="text-base font-bold text-slate-700">No skills found</p>
          <p className="text-xs text-slate-400 mt-1">
            {selectedResumeId !== "ALL"
              ? `No skills associated with Resume ID ${selectedResumeId.slice(0, 8)}...`
              : "Add your core technical competencies above or upload your resume to get started."}
          </p>
          {selectedResumeId !== "ALL" && (
            <button
              onClick={() => handleSelectResume("ALL")}
              className="mt-3 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              Clear Resume Filter
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedSkills.map((s) => {
            const hasResume = s.resumeIds && s.resumeIds.length > 0;
            return (
              <div
                key={s.id}
                className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-slate-300 transition flex flex-col justify-between gap-3 group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">
                      {s.skill?.name || (s as any).skillName || "Skill"}
                    </h4>
                    <StatusBadge status={s.verificationStatus} type="skill" />
                  </div>

                  <div className="mt-2 text-xs text-slate-500 space-y-1.5">
                    <div>
                      Proficiency: <span className="font-semibold text-slate-700">{s.declaredLevel || "Self-Declared"}</span>
                    </div>

                    {/* Source / Resume association */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <span className="text-[11px] text-slate-400">Source:</span>
                      {hasResume ? (
                        s.resumeIds!.map((rId) => (
                          <span
                            key={rId}
                            onClick={() => handleSelectResume(rId)}
                            className="cursor-pointer px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-mono font-semibold border border-blue-200 transition"
                            title={`Click to filter by Resume ID: ${rId}`}
                          >
                            📄 Resume: {rId.slice(0, 8)}
                          </span>
                        ))
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold">
                          ✍️ Added Manually
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    {s.verificationStatus === "EVALUATED" || s.verificationStatus === "VERIFIED"
                      ? "✓ Verified"
                      : "⏳ Mentioned by User"}
                  </span>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Remove skill"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
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
