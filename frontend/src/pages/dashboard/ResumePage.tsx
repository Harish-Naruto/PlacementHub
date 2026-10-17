import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  uploadResumeApi,
  fetchStudentResumes,
  deleteStudentResumeApi,
} from "../../api/student";
import { errorMessage } from "../../api/match";
import { ClaimCheckPanel } from "../../components/student/ClaimCheckPanel";
import { useAsync } from "../../components/student/useAsync";

/** Loosely typed parts of the parsed resume JSON that this page reads. */
interface ParsedSkill {
  name?: string;
  canonical_name?: string;
  category?: string;
}

export const ResumePage: React.FC = () => {
  const { accessToken } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { data, loading: loadingResumes, reload: loadResumes } = useAsync(async () => (accessToken ? fetchStudentResumes(accessToken) : []), "resumes");
  const resumes = (data ?? []).filter((r) => !removedIds.has(r.id));

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !file) return;

    setUploading(true);
    setMessage(null);
    try {
      const res = await uploadResumeApi(accessToken, file);
      setMessage({ type: "success", text: res.message || "Resume uploaded and parsed successfully!" });
      setFile(null);
      loadResumes();
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err, "Upload failed.") });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteResume = async (resumeId: string) => {
    if (!accessToken) return;
    if (!confirm("Are you sure you want to remove this resume record?")) return;
    try {
      await deleteStudentResumeApi(accessToken, resumeId);
      setRemovedIds((prev) => new Set(prev).add(resumeId));
      setMessage({ type: "success", text: "Resume removed." });
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err, "Failed to delete resume.") });
    }
  };

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Resume & Skill Management</h2>
        <p className="text-xs text-slate-500 mt-1">
          Upload resumes to extract verified skills. Each resume retains its unique ID and skill set for targeted assessments.
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          ✓ {message.text}
        </div>
      )}

      {/* Upload Box */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Upload New Resume</h3>
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-3xl p-8 text-center bg-slate-50/50 transition">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 mx-auto flex items-center justify-center font-bold text-xl mb-3">
              📄
            </div>
            <p className="text-sm font-bold text-slate-800">Select your resume file</p>
            <p className="text-xs text-slate-400 mt-1">PDF or DOCX documents up to 10MB</p>
            <input
              type="file"
              accept=".pdf,.docx,.doc"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-4 text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
            />
          </div>

          {file && (
            <div className="text-xs text-slate-600 font-semibold flex items-center justify-between">
              <span>Ready to upload: <strong className="text-blue-600">{file.name}</strong> ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!file || uploading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-500/25 transition disabled:opacity-50"
          >
            {uploading ? "Parsing & Uploading..." : "Upload & Extract Skills"}
          </button>
        </form>
      </div>

      {/* Saved Resumes List with per-resume skills */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Your Uploaded Resumes ({resumes.length})
          </h3>
          <span className="text-xs text-slate-400">Skills are isolated by Resume ID for tailored assessment generation</span>
        </div>

        {loadingResumes ? (
          <div className="text-center py-12 text-xs text-slate-400">Loading saved resumes...</div>
        ) : resumes.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200/80">
            <p className="text-sm font-bold text-slate-700">No resumes uploaded yet</p>
            <p className="text-xs text-slate-400 mt-1">Upload your first resume above to automatically parse and catalog its skills.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {resumes.map((item, index) => {
              const resumeData = item.resume as { skills?: ParsedSkill[] } | null;
              const skillsList: { name?: string; category?: string }[] = item.skills || (resumeData?.skills || []).map((s) => ({
                name: s.canonical_name || s.name,
                category: s.category || "Technology",
              }));

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:border-slate-300 transition space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm shadow-2xs">
                        #{index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-900">
                            Resume {index + 1}
                          </h4>
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono text-[11px] font-bold border border-blue-200">
                            ID: {item.id.slice(0, 8)}...
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                            Active
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Uploaded on {new Date(item.createdAt).toLocaleDateString()} at{" "}
                          {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        to={`/dashboard/skills?resumeId=${item.id}`}
                        className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <span>⚡</span> View Resume Skills ({skillsList.length})
                      </Link>
                      <button
                        onClick={() => handleDeleteResume(item.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                        title="Delete resume"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Skills extracted for this specific resume */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Skills in this Resume ({skillsList.length})
                      </span>
                      <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-medium border border-amber-200">
                        Mentioned by User • Unverified
                      </span>
                    </div>

                    {skillsList.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No specific technical skills detected in this resume.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {skillsList.map((sk, i) => (
                          <span
                            key={i}
                            className="px-3 py-1 rounded-full bg-slate-50 hover:bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-2xs transition"
                          >
                            {sk.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <ClaimCheckPanel token={accessToken} resumeId={item.id} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
