import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  fetchInstitutions,
  fetchStudentProfile,
  updateStudentProfile,
  FIXED_INSTITUTIONS,
  type Institution,
  type StudentProfileData,
} from "../../api/student";

export const ProfilePage: React.FC = () => {
  const { user, accessToken } = useAuth();
  const [institutions, setInstitutions] = useState<Institution[]>(FIXED_INSTITUTIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [form, setForm] = useState({
    name: "",
    institutionId: "",
    branch: "",
    degree: "",
    graduationYear: 2026,
    cgpa: 8.5,
    githubUsername: "",
    linkedinUrl: "",
    bio: "",
  });

  useEffect(() => {
    if (!accessToken) return;

    fetchInstitutions().then(setInstitutions).catch(() => {});

    fetchStudentProfile(accessToken)
      .then((p: StudentProfileData) => {
        setForm({
          name: user?.name || "",
          institutionId: p.institutionId || "",
          branch: p.branch || "",
          degree: p.degree || "",
          graduationYear: p.graduationYear || 2026,
          cgpa: p.cgpa ? Number(p.cgpa) : 8.5,
          githubUsername: p.githubUsername || "",
          linkedinUrl: p.linkedinUrl || "",
          bio: p.bio || "",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateStudentProfile(accessToken, {
        name: form.name || undefined,
        institutionId: form.institutionId || null,
        branch: form.branch || null,
        degree: form.degree || null,
        graduationYear: Number(form.graduationYear) || null,
        cgpa: Number(form.cgpa) || null,
        githubUsername: form.githubUsername || null,
        linkedinUrl: form.linkedinUrl || null,
        bio: form.bio || null,
      });
      setMessage({ type: "success", text: "Profile updated successfully!" });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to update profile." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-400 text-sm">Loading your profile...</div>;
  }

  return (
    <div className="max-w-4xl bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-sm space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Personal & Academic Profile</h2>
        <p className="text-xs text-slate-500 mt-1">Keep your verified university credentials and developer links current.</p>
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

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Full Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Institution</label>
            <select
              value={form.institutionId}
              onChange={(e) => setForm({ ...form, institutionId: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select your Institution</option>
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.city})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Degree</label>
            <input
              type="text"
              value={form.degree}
              onChange={(e) => setForm({ ...form, degree: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. B.Tech Computer Engineering"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Branch / Major</label>
            <input
              type="text"
              value={form.branch}
              onChange={(e) => setForm({ ...form, branch: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Computer Science"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Graduation Year</label>
            <input
              type="number"
              value={form.graduationYear}
              onChange={(e) => setForm({ ...form, graduationYear: Number(e.target.value) })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">CGPA (out of 10)</label>
            <input
              type="number"
              step="0.01"
              value={form.cgpa}
              onChange={(e) => setForm({ ...form, cgpa: Number(e.target.value) })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">GitHub Username</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 text-sm">github.com/</span>
              <input
                type="text"
                value={form.githubUsername}
                onChange={(e) => setForm({ ...form, githubUsername: e.target.value })}
                className="w-full pl-28 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="username"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">LinkedIn Profile URL</label>
            <input
              type="url"
              value={form.linkedinUrl}
              onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://linkedin.com/in/..."
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Short Bio</label>
          <textarea
            rows={3}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Introduce your engineering interests and specialties..."
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-500/25 transition disabled:opacity-50"
          >
            {saving ? "Saving Profile..." : "Save Profile Changes"}
          </button>
        </div>
      </form>
    </div>
  );
};
