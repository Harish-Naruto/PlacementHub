import React, { useCallback, useState } from "react";
import { fetchRecruiterProfile, saveRecruiterProfile } from "../../api/recruiterPortal";
import type { RecruiterProfileData } from "../../api/recruiterPortal";
import { ErrorBox, Loading, PageHeader } from "../../components/common/Feedback";
import { useAuth } from "../../context/AuthContext";
import { errorMessage, INPUT_CLS, LABEL_CLS, PRIMARY_BTN } from "../../components/recruiter/helpers";
import { useApi } from "../../components/recruiter/useApi";

interface FormState {
  companyName: string;
  website: string;
  city: string;
  country: string;
  description: string;
  jobTitle: string;
}

const fromProfile = (p: RecruiterProfileData): FormState => ({
  companyName: p.profile?.company.name ?? "",
  website: p.profile?.company.website ?? "",
  city: p.profile?.company.city ?? "",
  country: p.profile?.company.country ?? "",
  description: p.profile?.company.description ?? "",
  jobTitle: p.profile?.jobTitle ?? "",
});

const ProfileForm: React.FC<{ initial: RecruiterProfileData; onSaved: () => void }> = ({ initial, onSaved }) => {
  const { accessToken } = useAuth();
  const exists = initial.profile !== null;
  const [form, setForm] = useState<FormState>(() => fromProfile(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setSaved(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    if (!form.companyName.trim()) {
      setError("Company name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveRecruiterProfile(accessToken, {
        companyName: form.companyName.trim(),
        website: form.website.trim(),
        city: form.city.trim(),
        country: form.country.trim(),
        description: form.description.trim(),
        jobTitle: form.jobTitle.trim(),
      });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 max-w-2xl">
      <div>
        <label htmlFor="companyName" className={LABEL_CLS}>
          Company name
        </label>
        <input id="companyName" value={form.companyName} onChange={set("companyName")} readOnly={exists} required className={`${INPUT_CLS} ${exists ? "bg-slate-50 text-slate-500" : ""}`} />
        {exists ? (
          <p className="text-[11px] text-slate-400 mt-1">The company name is locked once saved, because your jobs and applicants belong to it. Ask the placement team if it needs to change.</p>
        ) : (
          <p className="text-[11px] text-slate-400 mt-1">Choose carefully: this cannot be changed after you save.</p>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="website" className={LABEL_CLS}>
            Website
          </label>
          <input id="website" type="url" value={form.website} onChange={set("website")} placeholder="https://example.com" className={INPUT_CLS} />
        </div>
        <div>
          <label htmlFor="jobTitle" className={LABEL_CLS}>
            Your job title
          </label>
          <input id="jobTitle" value={form.jobTitle} onChange={set("jobTitle")} placeholder="Campus Hiring Lead" className={INPUT_CLS} />
        </div>
        <div>
          <label htmlFor="city" className={LABEL_CLS}>
            City
          </label>
          <input id="city" value={form.city} onChange={set("city")} className={INPUT_CLS} />
        </div>
        <div>
          <label htmlFor="country" className={LABEL_CLS}>
            Country
          </label>
          <input id="country" value={form.country} onChange={set("country")} className={INPUT_CLS} />
        </div>
      </div>
      <div>
        <label htmlFor="description" className={LABEL_CLS}>
          About the company
        </label>
        <textarea id="description" value={form.description} onChange={set("description")} rows={4} maxLength={3000} className={INPUT_CLS} />
      </div>

      <ErrorBox message={error} />
      {saved && (
        <div role="status" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          {exists ? "Profile saved." : "Company profile created. You can post your first job now."}
        </div>
      )}
      <button type="submit" disabled={saving} className={PRIMARY_BTN}>
        {saving ? "Saving..." : exists ? "Save changes" : "Create company profile"}
      </button>
    </form>
  );
};

export const RecruiterProfilePage: React.FC = () => {
  const load = useCallback((token: string) => fetchRecruiterProfile(token), []);
  const { data, error, loading, reload } = useApi(load);
  const firstTime = data !== undefined && data.profile === null;

  return (
    <div>
      <PageHeader title="Company profile" subtitle="The company students see on your openings." />
      {firstTime && (
        <div className="mb-5 p-4 rounded-2xl bg-purple-50 border border-purple-200 max-w-2xl">
          <p className="text-sm font-bold text-purple-900">Welcome! Start by setting up your company.</p>
          <p className="text-xs text-purple-800/80 mt-1">
            Once your company exists you can paste job descriptions, publish openings and see applicants ranked by skills that are backed by evidence (assessments and GitHub work), not just claims.
          </p>
        </div>
      )}
      {loading && !data && <Loading />}
      {error !== undefined && <ErrorBox message={errorMessage(error)} onRetry={reload} />}
      {data && <ProfileForm initial={data} onSaved={reload} />}
    </div>
  );
};
