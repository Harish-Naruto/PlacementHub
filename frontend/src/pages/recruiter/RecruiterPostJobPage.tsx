import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createRecruiterJob, patchRecruiterJob, setRecruiterJobStatus } from "../../api/recruiterPortal";
import type { CreateJobResult, JobPatch } from "../../api/recruiterPortal";
import { preferredSkills, requiredSkills } from "../../api/types";
import type { EmploymentType, Job, WorkMode } from "../../api/types";
import { ErrorBox, PageHeader } from "../../components/common/Feedback";
import { ChipEditor, SkillListsEditor } from "../../components/recruiter/Chips";
import { useAuth } from "../../context/AuthContext";
import {
  EMPLOYMENT_LABEL,
  errorMessage,
  fromDateInput,
  INPUT_CLS,
  isProfileRequired,
  LABEL_CLS,
  PRIMARY_BTN,
  SECONDARY_BTN,
  toDateInput,
  WORK_MODE_LABEL,
} from "../../components/recruiter/helpers";
import { ProfileRequiredBox } from "../../components/recruiter/Shared";

type Origin = "pasted" | "manual";

// ---- step 1: paste (or type) the posting -------------------------------------------------------------

const InputStep: React.FC<{ onCreated: (r: CreateJobResult, origin: Origin) => void }> = ({ onCreated }) => {
  const { accessToken } = useAuth();
  const [manual, setManual] = useState(false);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [required, setRequired] = useState<string[]>([]);
  const [preferred, setPreferred] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setError(null);
    if (manual) {
      if (!title.trim() || !description.trim()) return setError("A title and a description are required.");
    } else if (text.trim().length < 20) {
      return setError("Paste the full job description (at least 20 characters).");
    }
    setBusy(true);
    try {
      const result = await createRecruiterJob(
        accessToken,
        manual
          ? { title: title.trim(), description: description.trim(), required, preferred, ...(location.trim() ? { location: location.trim() } : {}) }
          : { jobDescription: text.trim(), ...(title.trim() ? { title: title.trim() } : {}), ...(location.trim() ? { location: location.trim() } : {}) },
      );
      onCreated(result, manual ? "manual" : "pasted");
    } catch (err) {
      if (isProfileRequired(err)) setNeedsProfile(true);
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (needsProfile) return <ProfileRequiredBox />;

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 max-w-3xl">
      {manual ? (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="mTitle" className={LABEL_CLS}>
                Job title
              </label>
              <input id="mTitle" value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT_CLS} />
            </div>
            <div>
              <label htmlFor="mLoc" className={LABEL_CLS}>
                Location (optional)
              </label>
              <input id="mLoc" value={location} onChange={(e) => setLocation(e.target.value)} className={INPUT_CLS} />
            </div>
          </div>
          <div>
            <label htmlFor="mDesc" className={LABEL_CLS}>
              Description
            </label>
            <textarea id="mDesc" value={description} onChange={(e) => setDescription(e.target.value)} rows={8} className={INPUT_CLS} />
          </div>
          <SkillListsEditor required={required} preferred={preferred} onChange={(n) => {
              setRequired(n.required);
              setPreferred(n.preferred);
            }}
          />
        </>
      ) : (
        <>
          <div>
            <label htmlFor="jd" className="block text-sm font-black text-slate-900 mb-1">
              Paste the job description
            </label>
            <p className="text-xs text-slate-500 mb-2">Copy it from anywhere, even a WhatsApp message. We read the skills and details, and you review them before publishing.</p>
            <textarea id="jd" value={text} onChange={(e) => setText(e.target.value)} rows={12} placeholder="React Developer, Pune (hybrid)&#10;Must know React, Node.js and REST APIs. Git is a must.&#10;Nice to have: Docker, TypeScript..." className={INPUT_CLS} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="oTitle" className={LABEL_CLS}>
                Title override (optional)
              </label>
              <input id="oTitle" value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT_CLS} />
            </div>
            <div>
              <label htmlFor="oLoc" className={LABEL_CLS}>
                Location override (optional)
              </label>
              <input id="oLoc" value={location} onChange={(e) => setLocation(e.target.value)} className={INPUT_CLS} />
            </div>
          </div>
        </>
      )}

      <ErrorBox message={error} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="submit" disabled={busy} className={PRIMARY_BTN}>
          {busy ? "Reading..." : manual ? "Create draft" : "Parse"}
        </button>
        <button
          type="button"
          onClick={() => {
            setManual(!manual);
            setError(null);
          }}
          className="text-xs font-bold text-purple-700 hover:underline"
        >
          {manual ? "Paste a description instead" : "Enter details manually instead"}
        </button>
      </div>
    </form>
  );
};

// ---- step 2: review the draft ---------------------------------------------------------------------------

const ReviewStep: React.FC<{ result: CreateJobResult; origin: Origin }> = ({ result, origin }) => {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const job: Job = result.job;
  const initialDeadline = toDateInput(job.applicationDeadline);

  const [title, setTitle] = useState(job.title);
  const [description, setDescription] = useState(job.description);
  const [location, setLocation] = useState(job.location ?? "");
  const [workMode, setWorkMode] = useState<WorkMode>(job.workMode);
  const [employmentType, setEmploymentType] = useState<EmploymentType>(job.employmentType);
  const [minCgpa, setMinCgpa] = useState(job.minimumCgpa == null ? "" : String(job.minimumCgpa));
  const [deadline, setDeadline] = useState(initialDeadline);
  const [branches, setBranches] = useState(job.eligibleBranches.map((b) => b.branch));
  const [years, setYears] = useState(job.graduationYears.map((y) => String(y.graduationYear)));
  const [skills, setSkills] = useState({ required: requiredSkills(job), preferred: preferredSkills(job) });
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const buildPatch = (): JobPatch | string => {
    if (!title.trim()) return "A title is required.";
    const cgpa = minCgpa.trim() === "" ? null : Number(minCgpa);
    if (cgpa !== null && (Number.isNaN(cgpa) || cgpa < 0 || cgpa > 10)) return "Minimum CGPA must be a number between 0 and 10.";
    const gradYears = years.map(Number);
    if (gradYears.some((y) => !Number.isInteger(y) || y < 2020 || y > 2040)) return "Graduation years must be between 2020 and 2040.";
    return {
      title: title.trim(),
      description: description.trim() || job.description,
      location: location.trim() || null,
      workMode,
      employmentType,
      minimumCgpa: cgpa,
      ...(deadline !== initialDeadline ? { applicationDeadline: fromDateInput(deadline) } : {}),
      eligibleBranches: branches,
      graduationYears: gradYears,
      required: skills.required,
      preferred: skills.preferred,
    };
  };

  const run = async (publish: boolean) => {
    if (!accessToken) return;
    const patch = buildPatch();
    if (typeof patch === "string") return setError(patch);
    setBusy(publish ? "publish" : "save");
    setError(null);
    setSaved(false);
    try {
      await patchRecruiterJob(accessToken, job.id, patch);
      if (publish) {
        await setRecruiterJobStatus(accessToken, job.id, "publish");
        navigate(`/recruiter/jobs/${job.id}`);
        return;
      }
      setSaved(true);
    } catch (err) {
      const msg = errorMessage(err);
      setError(publish ? `${msg} Your changes were saved as a draft.` : msg);
    } finally {
      setBusy(null);
    }
  };

  const dup = result.possibleDuplicate;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${origin === "manual" ? "bg-slate-100 text-slate-700" : result.parseMethod === "llm" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"}`}>
          {origin === "manual" ? "Entered manually" : result.parseMethod === "llm" ? "Parsed by AI" : "Parsed by rules"}
        </span>
        <span className="text-xs text-slate-500">Draft saved. Check the details below, then publish when ready.</span>
      </div>

      {dup && (
        <div role="alert" className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold">
          Looks like an opening your company already has ({dup.kind}, {Math.round(dup.similarity)}% similar).{" "}
          <Link to={`/recruiter/jobs/${dup.jobId}`} className="underline font-bold">
            View that job
          </Link>
          . You can still publish this one.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="rTitle" className={LABEL_CLS}>
              Title
            </label>
            <input id="rTitle" value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label htmlFor="rLoc" className={LABEL_CLS}>
              Location
            </label>
            <input id="rLoc" value={location} onChange={(e) => setLocation(e.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label htmlFor="rDeadline" className={LABEL_CLS}>
              Application deadline
            </label>
            <input id="rDeadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label htmlFor="rMode" className={LABEL_CLS}>
              Work mode
            </label>
            <select id="rMode" value={workMode} onChange={(e) => setWorkMode(e.target.value as WorkMode)} className={INPUT_CLS}>
              {Object.entries(WORK_MODE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rType" className={LABEL_CLS}>
              Employment type
            </label>
            <select id="rType" value={employmentType} onChange={(e) => setEmploymentType(e.target.value as EmploymentType)} className={INPUT_CLS}>
              {Object.entries(EMPLOYMENT_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rCgpa" className={LABEL_CLS}>
              Minimum CGPA
            </label>
            <input id="rCgpa" type="number" min={0} max={10} step={0.1} value={minCgpa} onChange={(e) => setMinCgpa(e.target.value)} placeholder="No minimum" className={INPUT_CLS} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <ChipEditor label="Eligible branches" hint="Leave empty to allow every branch." values={branches} onChange={setBranches} placeholder="e.g. Computer Science" />
          <ChipEditor label="Graduation years" hint="Leave empty to allow every batch." values={years} onChange={setYears} placeholder="e.g. 2026" />
        </div>

        <SkillListsEditor required={skills.required} preferred={skills.preferred} onChange={setSkills} />

        <details className="text-xs">
          <summary className="cursor-pointer font-bold text-slate-700">Description</summary>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={10} className={`${INPUT_CLS} mt-2`} />
        </details>
      </div>

      <ErrorBox message={error} />
      {saved && (
        <div role="status" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          Draft saved.{" "}
          <Link to="/recruiter" className="underline">
            Back to my jobs
          </Link>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button disabled={busy !== null} onClick={() => run(false)} className={SECONDARY_BTN}>
          {busy === "save" ? "Saving..." : "Save draft"}
        </button>
        <button disabled={busy !== null} onClick={() => run(true)} className={PRIMARY_BTN}>
          {busy === "publish" ? "Publishing..." : "Save and publish"}
        </button>
      </div>
    </div>
  );
};

export const RecruiterPostJobPage: React.FC = () => {
  const [created, setCreated] = useState<{ result: CreateJobResult; origin: Origin } | null>(null);
  return (
    <div>
      <PageHeader
        title="Post a job"
        subtitle={created ? "Review what we understood from your posting." : "Paste a job description and we will pull out the skills and details."}
      />
      {created ? <ReviewStep key={created.result.job.id} result={created.result} origin={created.origin} /> : <InputStep onCreated={(result, origin) => setCreated({ result, origin })} />}
    </div>
  );
};
