import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  fetchStudentProjects,
  createStudentProject,
  deleteStudentProject,
  type ProjectData,
} from "../../api/student";

export const ProjectsPage: React.FC = () => {
  const { accessToken } = useAuth();
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    personalContribution: "",
    repositoryUrl: "",
    demoUrl: "",
    skillNames: "",
  });

  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    fetchStudentProjects(accessToken)
      .then(setProjects)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !form.title.trim()) return;

    setSubmitting(true);
    setModalError(null);
    try {
      const skillsArray = form.skillNames
        ? form.skillNames.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      const created = await createStudentProject(accessToken, {
        title: form.title.trim(),
        description: form.description.trim(),
        personalContribution: form.personalContribution.trim() || undefined,
        repositoryUrl: form.repositoryUrl.trim() || undefined,
        demoUrl: form.demoUrl.trim() || undefined,
        skillNames: skillsArray,
      });

      setProjects((prev) => [created, ...prev]);
      setShowModal(false);
      setModalError(null);
      setForm({
        title: "",
        description: "",
        personalContribution: "",
        repositoryUrl: "",
        demoUrl: "",
        skillNames: "",
      });
    } catch (err: any) {
      setModalError(err.message || "Failed to create project.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!accessToken) return;
    try {
      await deleteStudentProject(accessToken, id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete project.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Portfolio Projects</h2>
          <p className="text-xs text-slate-500 mt-1">Showcase your personal and academic software engineering work.</p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition self-start sm:self-auto"
        >
          + Add New Project
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80">
          <p className="text-base font-bold text-slate-700">No projects added yet</p>
          <p className="text-xs text-slate-400 mt-1">Click "+ Add New Project" to showcase your GitHub repositories and contributions.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {projects.map((p) => (
            <div key={p.id} className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{p.title}</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-3xl">{p.description}</p>
                </div>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="text-xs font-semibold text-rose-500 hover:text-rose-700 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition"
                >
                  Delete
                </button>
              </div>

              {p.personalContribution && (
                <p className="text-xs text-slate-600">
                  <span className="font-bold text-slate-800">My Contribution: </span>
                  {p.personalContribution}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                {p.repositoryUrl && (
                  <a
                    href={p.repositoryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline"
                  >
                    🔗 GitHub Repository
                  </a>
                )}
                {p.demoUrl && (
                  <a
                    href={p.demoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:underline"
                  >
                    🚀 Live Demo
                  </a>
                )}
                {p.skills?.map((s, idx) => (
                  <span key={idx} className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md">
                    {s.skill?.name || (s as any).skillName || "Skill"}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal for creating project */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Add Portfolio Project</h3>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Project Title</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Distributed Cache & KV Store"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Description</label>
                <textarea
                  rows={3}
                  required
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe problem, technical architecture, and results..."
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Your Specific Contribution</label>
                <input
                  type="text"
                  value={form.personalContribution}
                  onChange={(e) => setForm({ ...form, personalContribution: e.target.value })}
                  placeholder="e.g. Implemented raft consensus algorithm in Go"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">GitHub Repo URL</label>
                  <input
                    type="url"
                    value={form.repositoryUrl}
                    onChange={(e) => setForm({ ...form, repositoryUrl: e.target.value })}
                    placeholder="https://github.com/..."
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Live Demo URL</label>
                  <input
                    type="url"
                    value={form.demoUrl}
                    onChange={(e) => setForm({ ...form, demoUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tech Stack (comma separated)</label>
                <input
                  type="text"
                  value={form.skillNames}
                  onChange={(e) => setForm({ ...form, skillNames: e.target.value })}
                  placeholder="TypeScript, Docker, Redis, Postgres"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
