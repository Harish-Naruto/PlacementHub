import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  getRecruiterProfile,
  upsertRecruiterProfile,
  type RecruiterProfileData,
} from "../../api/recruiter";

export interface RecruiterProfileProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: (profile: RecruiterProfileData) => void;
}

export const RecruiterProfile: React.FC<RecruiterProfileProps> = ({
  isOpen,
  onClose,
  onProfileUpdated,
}) => {
  const { accessToken } = useAuth();
  const [profile, setProfile] = useState<RecruiterProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    companyName: "",
    companyWebsite: "",
    companyDescription: "",
    companyCity: "",
    companyCountry: "",
    jobTitle: "",
  });

  // Fetch or refresh profile whenever modal opens
  useEffect(() => {
    if (!isOpen || !accessToken) return;
    setLoading(true);
    setError(null);
    setSuccess(false);

    getRecruiterProfile(accessToken)
      .then((data) => {
        if (!data) return;
        setProfile(data);
        setForm({
          companyName: data.company?.name ?? "",
          companyWebsite: data.company?.website ?? "",
          companyDescription: data.company?.description ?? "",
          companyCity: data.company?.city ?? "",
          companyCountry: data.company?.country ?? "",
          jobTitle: data.jobTitle ?? "",
        });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      })
      .finally(() => setLoading(false));
  }, [isOpen, accessToken]);

  // Handle ESC key press to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const data = await upsertRecruiterProfile(accessToken, {
        companyName: form.companyName.trim(),
        companyWebsite: form.companyWebsite.trim() || undefined,
        companyDescription: form.companyDescription.trim() || undefined,
        companyCity: form.companyCity.trim() || undefined,
        companyCountry: form.companyCountry.trim() || undefined,
        jobTitle: form.jobTitle.trim() || undefined,
      });

      setProfile(data);
      setSuccess(true);
      if (onProfileUpdated) {
        onProfileUpdated(data);
      }
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      {/* Click outside backdrop */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-xl bg-[#13132a] border border-white/10 rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden z-10 text-white animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-lg font-black text-white shadow-lg shadow-indigo-500/25">
              {profile?.company?.name ? profile.company.name.charAt(0).toUpperCase() : "🏢"}
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white tracking-tight">Company Profile</h2>
              <p className="text-xs text-slate-400">
                {profile?.company ? "Edit your organization details" : "Set up your company information"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Permanent Company Policy Banner */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-200/90 leading-relaxed">
            <span className="text-base leading-none">🛡️</span>
            <div>
              <span className="font-semibold text-indigo-200">Permanent Record: </span>
              Company profiles cannot be deleted once registered to maintain job audit integrity. You can edit and update company information at any time.
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <form id="recruiter-profile-form" onSubmit={handleSubmit} className="space-y-4">
              {success && (
                <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium animate-in fade-in duration-200">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Profile updated successfully!
                </div>
              )}
              {error && (
                <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Company Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    required
                    value={form.companyName}
                    onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                    placeholder="e.g. Acme Innovations Inc."
                    className="w-full bg-white/[0.05] border border-white/10 text-white placeholder-slate-600 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Your Job Title</label>
                  <input
                    value={form.jobTitle}
                    onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
                    placeholder="e.g. Talent Acquisition Lead"
                    className="w-full bg-white/[0.05] border border-white/10 text-white placeholder-slate-600 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Website</label>
                  <input
                    type="url"
                    value={form.companyWebsite}
                    onChange={(e) => setForm((f) => ({ ...f, companyWebsite: e.target.value }))}
                    placeholder="https://acme.com"
                    className="w-full bg-white/[0.05] border border-white/10 text-white placeholder-slate-600 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">City</label>
                  <input
                    value={form.companyCity}
                    onChange={(e) => setForm((f) => ({ ...f, companyCity: e.target.value }))}
                    placeholder="e.g. Bangalore"
                    className="w-full bg-white/[0.05] border border-white/10 text-white placeholder-slate-600 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Country</label>
                  <input
                    value={form.companyCountry}
                    onChange={(e) => setForm((f) => ({ ...f, companyCountry: e.target.value }))}
                    placeholder="e.g. India"
                    className="w-full bg-white/[0.05] border border-white/10 text-white placeholder-slate-600 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Company Description</label>
                  <textarea
                    rows={3}
                    value={form.companyDescription}
                    onChange={(e) => setForm((f) => ({ ...f, companyDescription: e.target.value }))}
                    placeholder="Tell candidates about your company culture, mission, and work..."
                    className="w-full bg-white/[0.05] border border-white/10 text-white placeholder-slate-600 rounded-xl px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition"
                  />
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.08] bg-white/[0.02]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="recruiter-profile-form"
            disabled={saving || loading}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl shadow-lg shadow-indigo-500/25 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Saving...
              </>
            ) : profile?.company ? (
              "Save Changes"
            ) : (
              "Create Profile"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export const RecruiterProfileModal = RecruiterProfile;
