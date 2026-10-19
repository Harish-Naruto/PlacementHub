import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { deleteRecruiterJob, fetchRecruiterJobs } from "../../api/recruiterPortal";
import type { RecruiterJob } from "../../api/recruiterPortal";
import { STAGE_ORDER } from "../../api/types";
import type { JobStatus } from "../../api/types";
import { Empty, ErrorBox, Loading, PageHeader } from "../../components/common/Feedback";
import { useAuth } from "../../context/AuthContext";
import { DANGER_BTN, EMPLOYMENT_LABEL, errorMessage, isProfileRequired, JOB_STATUS_LABEL, PRIMARY_BTN, WORK_MODE_LABEL } from "../../components/recruiter/helpers";
import { JobStatusActions, JobStatusBadge, ProfileRequiredBox, SourcesBadge } from "../../components/recruiter/Shared";
import { useApi } from "../../components/recruiter/useApi";

const FILTERS: (JobStatus | "ALL")[] = ["ALL", "DRAFT", "PUBLISHED", "PAUSED", "CLOSED"];

const StageMini: React.FC<{ job: RecruiterJob }> = ({ job }) => (
  <div className="flex flex-wrap gap-1.5">
    {STAGE_ORDER.map((s) => (
      <span key={s} className="px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
        {s} <span className="font-bold text-slate-800">{job.applicantsByStage[s] ?? 0}</span>
      </span>
    ))}
  </div>
);

export const RecruiterJobsPage: React.FC = () => {
  const { accessToken } = useAuth();
  const [filter, setFilter] = useState<JobStatus | "ALL">("ALL");
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback((token: string) => fetchRecruiterJobs(token, filter === "ALL" ? undefined : filter), [filter]);
  const { data: jobs, error, loading, reload } = useApi(load);

  const remove = async (job: RecruiterJob) => {
    if (!accessToken || !window.confirm(`Delete the draft "${job.title}"? This cannot be undone.`)) return;
    setDeleting(job.id);
    setActionError(null);
    try {
      await deleteRecruiterJob(accessToken, job.id);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setDeleting(null);
    }
  };

  const changed = () => {
    setActionError(null);
    reload();
  };

  if (isProfileRequired(error)) return <ProfileRequiredBox />;

  return (
    <div>
      <PageHeader
        title="My jobs"
        subtitle="Your openings and how many candidates are at each step."
        actions={
          <Link to="/recruiter/jobs/new" className={PRIMARY_BTN}>
            Post a job
          </Link>
        }
      />

      <div className="flex flex-wrap gap-1.5 mb-5" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${filter === f ? "bg-purple-600 text-white border-purple-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
          >
            {f === "ALL" ? "All" : JOB_STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <ErrorBox message={actionError} />
        {loading && !jobs && <Loading />}
        {error !== undefined && <ErrorBox message={errorMessage(error)} onRetry={reload} />}
        {jobs && jobs.length === 0 && (
          <Empty title={filter === "ALL" ? "You have not posted any jobs yet" : `No ${JOB_STATUS_LABEL[filter].toLowerCase()} jobs`} hint="Paste a job description and we will read the skills for you.">
            <Link to="/recruiter/jobs/new" className={PRIMARY_BTN}>
              Post a job
            </Link>
          </Empty>
        )}
        {jobs?.map((job) => (
          <div key={job.id} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/recruiter/jobs/${job.id}`} className="text-sm font-black text-slate-900 hover:text-purple-700">
                    {job.title}
                  </Link>
                  <JobStatusBadge status={job.status} />
                  <SourcesBadge job={job} />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {[job.location, WORK_MODE_LABEL[job.workMode], EMPLOYMENT_LABEL[job.employmentType]].filter(Boolean).join(" · ")}
                  {job.applicationDeadline && ` · Deadline ${new Date(job.applicationDeadline).toLocaleDateString()}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-slate-900 leading-none">{job.applicants}</p>
                <p className="text-[11px] text-slate-500">applicant{job.applicants === 1 ? "" : "s"}</p>
              </div>
            </div>

            <StageMini job={job} />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <JobStatusActions job={job} onChanged={changed} onError={setActionError} />
                {job.status === "DRAFT" && job.applicants === 0 && (
                  <button disabled={deleting === job.id} onClick={() => remove(job)} className={DANGER_BTN}>
                    Delete draft
                  </button>
                )}
              </div>
              <Link to={`/recruiter/jobs/${job.id}`} className="text-xs font-bold text-purple-700 hover:underline">
                View applicants
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
