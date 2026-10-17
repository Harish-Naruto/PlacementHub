import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { applyToJobDetailed, errorMessage, fetchJobsWithFit, fetchMyApplications, type JobWithFit } from "../../api/match";
import { requiredSkills } from "../../api/types";
import { FitBadge } from "../../components/common/FitBadge";
import { Empty, ErrorBox, Loading, PageHeader } from "../../components/common/Feedback";
import { Chip, Notice } from "../../components/student/Chip";
import { useAsync } from "../../components/student/useAsync";

const EMPLOYMENT_LABEL: Record<string, string> = { FULL_TIME: "Full time", INTERNSHIP: "Internship", CONTRACT: "Contract", PART_TIME: "Part time" };
const MODE_LABEL: Record<string, string> = { ONSITE: "On-site", HYBRID: "Hybrid", REMOTE: "Remote" };

export const JobsPage: React.FC = () => {
  const { accessToken } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [justApplied, setJustApplied] = useState<Set<string>>(new Set());
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { data, loading, error, reload } = useAsync(async () => {
    if (!accessToken) throw new Error("Please sign in again.");
    const [page, apps] = await Promise.all([fetchJobsWithFit(accessToken, { search, limit: 50 }), fetchMyApplications(accessToken)]);
    return { jobs: page.jobs, applied: apps.filter((a) => a.status !== "WITHDRAWN").map((a) => a.jobPosting?.id ?? a.jobPostingId ?? "") };
  }, search);

  const jobs: JobWithFit[] = data?.jobs ?? [];
  const appliedIds = new Set([...(data?.applied ?? []), ...justApplied]);

  const handleApply = async (jobId: string) => {
    if (!accessToken) return;
    setApplyingId(jobId);
    setMessage(null);
    try {
      await applyToJobDetailed(accessToken, jobId);
      setJustApplied((prev) => new Set(prev).add(jobId));
      setMessage({ type: "success", text: "Applied. You can follow progress in Applications." });
    } catch (e) {
      setMessage({ type: "error", text: errorMessage(e, "Failed to apply.") });
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Job openings" subtitle="Sorted by how well your verified skills match each opening." />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(searchInput.trim());
        }}
        className="flex gap-2"
      >
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by title, company or skill"
          className="flex-1 min-w-0 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="submit" disabled={loading} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl disabled:opacity-50">
          Search
        </button>
      </form>

      {message && <Notice tone={message.type}>{message.text}</Notice>}
      <ErrorBox message={error ? errorMessage(error, "Could not load jobs.") : null} onRetry={reload} />

      {loading ? (
        <Loading label="Loading openings..." />
      ) : jobs.length === 0 && !error ? (
        <Empty title={search ? "No openings match your search" : "No open positions right now"} hint={search ? "Try a different keyword." : "New openings will show up here."} />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {jobs.map((job) => {
            const applied = appliedIds.has(job.id);
            const required = requiredSkills(job);
            const fit = job.fit;
            return (
              <div key={job.id} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/dashboard/jobs/${job.id}`} className="text-base font-bold text-slate-900 hover:text-blue-700">
                      {job.title}
                    </Link>
                    {fit && <FitBadge score={fit.fitScore} band={fit.band} />}
                    {fit && !fit.eligible && <Chip tone="rose">Not eligible</Chip>}
                  </div>
                  <p className="text-xs font-semibold text-slate-600">
                    {job.company?.name ?? "Hiring partner"} · {job.location || "Location not listed"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Chip tone="blue">{EMPLOYMENT_LABEL[job.employmentType] ?? job.employmentType}</Chip>
                    <Chip>{MODE_LABEL[job.workMode] ?? job.workMode}</Chip>
                    {job.sourceCount > 1 && <Chip tone="amber">Seen from {job.sourceCount} sources</Chip>}
                  </div>
                  {required.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {required.map((s) => (
                        <span key={s} className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-700">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  {fit && fit.requiredTotal > 0 && (
                    <p className="text-xs text-slate-500">
                      {fit.requiredDemonstrated} of {fit.requiredTotal} required skills demonstrated
                    </p>
                  )}
                </div>

                <div className="flex sm:flex-col gap-2 sm:items-stretch shrink-0">
                  <Link to={`/dashboard/jobs/${job.id}`} className="px-4 py-2 text-center rounded-xl text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50">
                    View fit
                  </Link>
                  <button
                    onClick={() => void handleApply(job.id)}
                    disabled={applied || applyingId === job.id}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${
                      applied ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                    }`}
                  >
                    {applied ? "Applied" : applyingId === job.id ? "Applying..." : "Apply"}
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
