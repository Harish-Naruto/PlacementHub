import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  fetchStudentSkills,
  addStudentSkill,
  deleteStudentSkill,
  type StudentSkill,
} from "../../api/student";
import { StatusBadge } from "../../components/common/StatusBadge";

export const SkillsPage: React.FC = () => {
  const { accessToken } = useAuth();
  const [skills, setSkills] = useState<StudentSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillLevel, setNewSkillLevel] = useState("INTERMEDIATE");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    fetchStudentSkills(accessToken)
      .then(setSkills)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Technical Skills & Evidence</h2>
        <p className="text-xs text-slate-500 mt-1">Manage self-declared, repository-observed, and evaluated skills.</p>
      </div>

      {/* Add Skill Form */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Add New Skill</label>
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

      {/* Skills Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading skills...</div>
      ) : skills.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80">
          <p className="text-base font-bold text-slate-700">No skills assigned yet</p>
          <p className="text-xs text-slate-400 mt-1">Add your core technical competencies above to begin matching with jobs.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((s) => (
            <div
              key={s.id}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-slate-300 transition flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-slate-900">{s.skill?.name || (s as any).skillName || "Skill"}</h4>
                  <StatusBadge status={s.verificationStatus} type="skill" />
                </div>
                <p className="text-xs text-slate-500 mt-1">Level: {s.declaredLevel || "Self-Declared"}</p>
              </div>

              <button
                onClick={() => handleDelete(s.id)}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                title="Remove skill"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
