import React, { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { changeApplicantStatus, fetchApplicants, fetchRecruiterJob, patchRecruiterJob } from "../../api/recruiterPortal";
import type { ApplicantRow, ApplicantsFilter } from "../../api/recruiterPortal";
import { preferredSkills, requiredSkills, STAGE_ORDER, STATUS_LABEL } from "../../api/types";
import type { ApplicationStatus, Job, Stage } from "../../api/types";
import { Empty, ErrorBox, Loading } from "../../components/common/Feedback";
import { FitBadge, FitBar } from "../../components/common/FitBadge";
import { ApplicantDrawer } from "../../components/recruiter/ApplicantDrawer";
import { SkillListsEditor } from "../../components/recruiter/Chips";
import { StatusControls } from "../../components/recruiter/StatusControls";
import { useApi } from "../../components/recruiter/useApi";
import { useAuth } from "../../context/AuthContext";
import { EMPLOYMENT_LABEL, errorMessage, INPUT_CLS, isProfileRequired, PRIMARY_BTN, SECONDARY_BTN, WORK_MODE_LABEL } from "../../components/recruiter/helpers";
import { JobStatusActions, JobStatusBadge, ProfileRequiredBox, SourcesBadge } from "../../components/recruiter/Shared";

// ---- skills editor ------------------------------------------------------------------------------------

const SkillsEditor: React.FC<{ job: Job; onSaved: () => void; onCancel: () => void }> = ({ job, onSaved, onCancel }) => {
  const { accessToken } = useAuth();
  const [skills, setSkills] = useState({ required: requiredSkills(job), preferred: preferredSkills(job) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      await patchRecruiterJob(accessToken, job.id, skills);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
      <SkillListsEditor required={skills.required} preferred={skills.preferred} onChange={setSkills} />
      <p className="text-[11px] text-slate-500">Saving re-ranks the applicants against the new skills.</p>
      <ErrorBox message={error} />
      <div className="flex gap-2">
        <button disabled={busy} onClick={save} className={PRIMARY_BTN}>
          {busy ? "Saving..." : "Save skills"}
        </button>
        <button disabled={busy} onClick={onCancel} className={SECONDARY_BTN}>
          Cancel
        </button>
      </div>
    </div>
  );
};

// ---- applicants table ---------------------------------------------------------------------------------

const Chip: React.FC<{ cls: string; title?: string; children: React.ReactNode }> = ({ cls, title, children }) => (
  <span title={title} className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${cls}`}>
    {children}
  </span>
);

const ApplicantTableRow: React.FC<{ row: ApplicantRow; onOpen: () => void; onChange: (to: ApplicationStatus, note: string) => Promise<void> }> = ({ row, onOpen, onChange }) => {
  const matchedReq = row.matched.filter((m) => m.requirement === "REQUIRED").length;
  const gapsReq = row.gaps.filter((g) => g.requirement === "REQUIRED");
  const topMatched = row.matched.slice(0, 3);
  const topGaps = [...gapsReq, ...row.gaps.filter((g) => g.requirement !== "REQUIRED")].slice(0, 3);
  const moreGaps = row.gaps.length - topGaps.length;

  return (
    <tr className="align-top hover:bg-purple-50/40 cursor-pointer" onClick={onOpen}>
      <td className="px-3 py-3 font-black text-slate-500">{row.rank}</td>
      <td className="px-3 py-3 min-w-48">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="font-bold text-slate-900 hover:text-purple-700 text-left"
        >
          {row.name}
        </button>
        <p className="text-[11px] text-slate-500">{[row.branch, row.cgpa != null ? `CGPA ${row.cgpa}` : null, row.graduationYear ? `Batch ${row.graduationYear}` : null].filter(Boolean).join(" · ")}</p>
        {row.institution && <p className="text-[11px] text-slate-400">{row.institution}</p>}
      </td>
      <td className="px-3 py-3">
        <div className="space-y-1.5">
          <FitBadge score={row.fitScore} band={row.band} />
          <FitBar score={row.fitScore} />
        </div>
      </td>
      <td className="px-3 py-3 font-bold text-slate-800 whitespace-nowrap">
        {matchedReq}/{matchedReq + gapsReq.length}
      </td>
      <td className="px-3 py-3 min-w-40">
        <div className="flex flex-wrap gap-1">
          {topMatched.length === 0 && <span className="text-slate-400">None</span>}
          {topMatched.map((m) => (
            <Chip key={m.skill} cls="bg-emerald-50 text-emerald-800 border-emerald-200" title={m.requirement === "REQUIRED" ? "Required" : "Preferred"}>
              {m.skill}
              {m.combinedScore != null && <span className="opacity-60"> {m.combinedScore}</span>}
            </Chip>
          ))}
        </div>
      </td>
      <td className="px-3 py-3 min-w-40">
        <div className="flex flex-wrap gap-1">
          {topGaps.length === 0 && <span className="text-slate-400">None</span>}
          {topGaps.map((g) => (
            <Chip key={g.skill} cls={g.requirement === "REQUIRED" ? "bg-rose-50 text-rose-800 border-rose-200" : "bg-amber-50 text-amber-800 border-amber-200"} title={`${g.requirement === "REQUIRED" ? "Required" : "Preferred"}: ${g.detail}`}>
              {g.skill}
            </Chip>
          ))}
          {moreGaps > 0 && <span className="text-[11px] text-slate-400">+{moreGaps}</span>}
        </div>
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        {row.claimCheck ? (
          <span className={row.claimCheck.flagged > 0 ? "font-semibold text-amber-800" : "text-slate-700"} title="Resume claims that are not backed by evidence yet are flagged for review">
            {row.claimCheck.flagged} of {row.claimCheck.total} claims flagged
          </span>
        ) : (
          <span className="text-slate-400">no resume check</span>
        )}
      </td>
      <td className="px-3 py-3">
        {row.eligible ? (
          <span className="text-slate-400">Eligible</span>
        ) : (
          <Chip cls="bg-rose-50 text-rose-800 border-rose-200" title={row.eligibilityFlags.join("\n")}>
            Not eligible
          </Chip>
        )}
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <span className="font-semibold text-slate-700">{STATUS_LABEL[row.status]}</span>
      </td>
      <td className="px-3 py-3 min-w-56">
        <StatusControls status={row.status} onChange={onChange} />
      </td>
    </tr>
  );
};

const COLUMNS = ["#", "Candidate", "Fit", "Required skills", "Matched", "Gaps", "Claim integrity", "Eligibility", "Status", "Actions"];

// ---- page ---------------------------------------------------------------------------------------------

export const RecruiterJobDetailPage: React.FC = () => {
  const { jobId = "" } = useParams();
  const { accessToken } = useAuth();

  const [actionError, setActionError] = useState<string | null>(null);
  const [editingSkills, setEditingSkills] = useState(false);
  const [openApp, setOpenApp] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage | "">("");
  const [minFitText, setMinFitText] = useState("");
  const [eligibleOnly, setEligibleOnly] = useState(false);

  const minFitNum = minFitText.trim() === "" ? NaN : Number(minFitText);
  const minFit = Number.isInteger(minFitNum) && minFitNum >= 0 && minFitNum <= 100 ? minFitNum : undefined;

  const loadJob = useCallback((token: string) => fetchRecruiterJob(token, jobId), [jobId]);
  const jobApi = useApi(loadJob);

  const loadApplicants = useCallback(
    (token: string) => {
      const filter: ApplicantsFilter = { stage: stage || undefined, minFit, eligibleOnly };
      return fetchApplicants(token, jobId, filter);
    },
    [jobId, stage, minFit, eligibleOnly],
  );
  const appsApi = useApi(loadApplicants);

  const job = jobApi.data?.id === jobId ? jobApi.data : undefined;
  const apps = appsApi.data?.job.id === jobId ? appsApi.data : undefined;

  const changeStatus = (applicationId: string) => async (to: ApplicationStatus, note: string) => {
    if (!accessToken) throw new Error("You are signed out. Please sign in again.");
    await changeApplicantStatus(accessToken, applicationId, to, note || undefined);
    appsApi.reload();
  };

  if (isProfileRequired(jobApi.error) || isProfileRequired(appsApi.error)) return <ProfileRequiredBox />;

  return (
    <div className="space-y-6">
      <Link to="/recruiter" className="text-xs font-bold text-purple-700 hover:underline">
        ← My jobs
      </Link>

      {jobApi.loading && !job && <Loading />}
      {jobApi.error !== undefined && <ErrorBox message={errorMessage(jobApi.error)} onRetry={jobApi.reload} />}

      {job && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">{job.title}</h1>
                <JobStatusBadge status={job.status} />
                <SourcesBadge job={job} />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {[job.location, WORK_MODE_LABEL[job.workMode], EMPLOYMENT_LABEL[job.employmentType]].filter(Boolean).join(" · ")}
                {job.applicationDeadline && ` · Deadline ${new Date(job.applicationDeadline).toLocaleDateString()}`}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {requiredSkills(job).map((s) => (
                  <Chip key={s} cls="bg-purple-50 text-purple-800 border-purple-200" title="Required">
                    {s}
                  </Chip>
                ))}
                {preferredSkills(job).map((s) => (
                  <Chip key={s} cls="bg-blue-50 text-blue-800 border-blue-200" title="Preferred">
                    {s}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <JobStatusActions
                job={job}
                onChanged={() => {
                  setActionError(null);
                  jobApi.reload();
                }}
                onError={setActionError}
              />
              {job.status !== "CLOSED" && (
                <button onClick={() => setEditingSkills((v) => !v)} className={SECONDARY_BTN}>
                  {editingSkills ? "Hide skill editor" : "Edit skills"}
                </button>
              )}
            </div>
          </div>
          {actionError && (
            <div className="mt-3">
              <ErrorBox message={actionError} />
            </div>
          )}
          {editingSkills && (
            <SkillsEditor
              key={job.skillRequirements.map((r) => r.skillId + r.requirementType).join()}
              job={job}
              onCancel={() => setEditingSkills(false)}
              onSaved={() => {
                setEditingSkills(false);
                jobApi.reload();
                appsApi.reload();
              }}
            />
          )}
        </div>
      )}

      <section>
        <h2 className="text-sm font-black text-slate-900">Ranked applicants</h2>
        <p className="text-xs text-slate-500 mt-1 mb-3">Ranked by evidence-backed fit: verified skills count, claims without evidence do not.</p>

        <div className="flex flex-wrap items-end gap-3 mb-3">
          <div>
            <label htmlFor="fStage" className="block text-[11px] font-bold text-slate-600 mb-1">
              Stage
            </label>
            <select id="fStage" value={stage} onChange={(e) => setStage(e.target.value as Stage | "")} className={`${INPUT_CLS} !w-auto`}>
              <option value="">All stages</option>
              {STAGE_ORDER.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="fMin" className="block text-[11px] font-bold text-slate-600 mb-1">
              Minimum fit
            </label>
            <input id="fMin" type="number" min={0} max={100} value={minFitText} onChange={(e) => setMinFitText(e.target.value)} placeholder="0-100" className={`${INPUT_CLS} !w-24`} />
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 pb-2">
            <input type="checkbox" checked={eligibleOnly} onChange={(e) => setEligibleOnly(e.target.checked)} className="accent-purple-600" />
            Eligible only
          </label>
          {appsApi.loading && apps && <span className="text-[11px] text-slate-400 pb-2">Updating...</span>}
        </div>

        {appsApi.loading && !apps && <Loading label="Ranking applicants..." />}
        {appsApi.error !== undefined && <ErrorBox message={errorMessage(appsApi.error)} onRetry={appsApi.reload} />}
        {apps && apps.rows.length === 0 && (
          <Empty
            title={apps.total === 0 ? "No applicants yet" : "No applicants match these filters"}
            hint={apps.total === 0 ? "Students apply once the job is published. They will show up here ranked by fit." : `${apps.total} applicant${apps.total === 1 ? "" : "s"} hidden by the filters.`}
          />
        )}
        {apps && apps.rows.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  {COLUMNS.map((c) => (
                    <th key={c} className="px-3 py-2.5 font-bold whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {apps.rows.map((row) => (
                  <ApplicantTableRow key={row.applicationId} row={row} onOpen={() => setOpenApp(row.applicationId)} onChange={changeStatus(row.applicationId)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {openApp && <ApplicantDrawer applicationId={openApp} onClose={() => setOpenApp(null)} onChanged={appsApi.reload} />}
    </div>
  );
};
