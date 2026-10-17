import React from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { errorMessage, fetchJobDetail, fetchJobFit } from "../../api/match";
import { preferredSkills, requiredSkills, SOURCE_LABEL } from "../../api/types";
import { FitBadge } from "../../components/common/FitBadge";
import { ErrorBox, Loading } from "../../components/common/Feedback";
import { Card, Chip, Notice } from "../../components/student/Chip";
import { GAP_KIND_LABEL } from "../../components/student/labels";
import { useApply } from "../../components/student/useApply";
import { useAsync } from "../../components/student/useAsync";

const SKILL_TONE = {
  demonstrated: "bg-emerald-50 text-emerald-800 border-emerald-300",
  gap: "bg-amber-50 text-amber-800 border-amber-300",
  unknown: "bg-slate-50 text-slate-700 border-slate-200",
} as const;

export const JobDetailPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const { accessToken } = useAuth();
  const { applying, applied, error: applyError, apply } = useApply(accessToken, jobId);

  const { data, loading, error, reload } = useAsync(async () => {
    if (!accessToken || !jobId) throw new Error("Please sign in again.");
    const [job, fit] = await Promise.all([fetchJobDetail(accessToken, jobId), fetchJobFit(accessToken, jobId)]);
    return { job, fit };
  }, jobId ?? "");

  if (loading) return <Loading label="Loading job..." />;
  if (error || !data) return <ErrorBox message={error ? errorMessage(error, "Could not load this job.") : "Job not found."} onRetry={reload} />;
  const { job, fit } = data;

  const demonstrated = new Set(fit.matched.map((m) => m.skill));
  const gapSkills = new Set(fit.gaps.map((g) => g.skill));
  const skillClass = (s: string) => SKILL_TONE[demonstrated.has(s) ? "demonstrated" : gapSkills.has(s) ? "gap" : "unknown"];
  const required = requiredSkills(job);
  const preferred = preferredSkills(job);
  const notEligible = !fit.eligibility.eligible;
  const isOpen = job.status === "PUBLISHED";

  const skillChips = (skills: string[]) => (
    <div className="flex flex-wrap gap-1.5">
      {skills.map((s) => (
        <span key={s} className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${skillClass(s)}`}>
          {demonstrated.has(s) ? "✓ " : gapSkills.has(s) ? "! " : ""}
          {s}
        </span>
      ))}
    </div>
  );

  return (
    <div className="space-y-5 max-w-5xl">
      <Link to="/dashboard/jobs" className="text-xs font-bold text-blue-600 hover:underline">
        ← All openings
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
        <h1 className="text-xl font-black text-slate-900 tracking-tight">{job.title}</h1>
        <p className="text-sm font-semibold text-slate-600">
          {job.company?.name ?? "Hiring partner"} · {job.location || "Location not listed"}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Chip tone="blue">{job.employmentType.replace("_", " ").toLowerCase()}</Chip>
          <Chip>{job.workMode.toLowerCase()}</Chip>
          {job.sourceCount > 1 && <Chip tone="amber">Seen from {job.sourceCount} sources</Chip>}
        </div>
        <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed pt-2">{job.description}</p>
      </div>

      {/* Fit panel */}
      <section className="bg-white rounded-2xl border-2 border-blue-200 p-5 space-y-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-center min-w-20">
            <div className="text-5xl font-black text-slate-900 leading-none">{fit.fitScore ?? "–"}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1">out of 100</div>
          </div>
          <div className="space-y-1.5 flex-1 min-w-52">
            <div className="flex flex-wrap items-center gap-2">
              <FitBadge score={fit.fitScore} band={fit.band} />
              <span className="text-xs text-slate-500">
                {fit.requiredDemonstrated} of {fit.requiredTotal} required skills demonstrated
              </span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{fit.explanation}</p>
          </div>
        </div>

        {fit.eligibility.flags.length > 0 && (
          <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            <p className="font-bold mb-1">Not eligible for this opening</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {fit.eligibility.flags.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}
        {fit.eligibility.unknown.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            <p className="font-bold mb-1">Could not check yet</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {fit.eligibility.unknown.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <Link to="/dashboard/profile" className="inline-block mt-1 font-bold underline">
              Complete your profile
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2">Demonstrated ({fit.matched.length})</h3>
            {fit.matched.length === 0 ? (
              <p className="text-xs text-slate-500">Nothing demonstrated for this opening yet.</p>
            ) : (
              <ul className="space-y-2">
                {fit.matched.map((m) => (
                  <li key={m.skill} className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {m.skill} <span className="text-[11px] font-semibold text-slate-500">{m.requirement === "REQUIRED" ? "required" : "preferred"}</span>
                      </span>
                      <span className="text-xs font-black text-emerald-800">{m.combinedScore ?? "–"}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{m.detail}</p>
                    {m.evidenceUrls.length > 0 && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                        {m.evidenceUrls.map((u, i) => (
                          <a key={u} href={u} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 hover:underline">
                            Evidence {m.evidenceUrls.length > 1 ? i + 1 : ""}
                          </a>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2">Gaps ({fit.gaps.length})</h3>
            {fit.gaps.length === 0 ? (
              <p className="text-xs text-slate-500">No gaps. Every listed skill is demonstrated.</p>
            ) : (
              <ul className="space-y-2">
                {fit.gaps.map((g) => (
                  <li key={g.skill} className="p-3 rounded-xl bg-amber-50/60 border border-amber-200">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{g.skill}</span>
                      <Chip tone={g.requirement === "REQUIRED" ? "rose" : "slate"}>{g.requirement === "REQUIRED" ? "Required" : "Preferred"}</Chip>
                      <span className="text-[11px] font-semibold text-slate-500">{GAP_KIND_LABEL[g.kind]}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{g.detail}</p>
                    <p className="text-xs text-slate-800 mt-1">
                      <span className="font-bold">What to do: </span>
                      {g.action}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Link to={`/dashboard/jobs/${job.id}/resume`} className="px-5 py-2.5 bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 rounded-xl text-xs font-bold">
            Build tailored resume
          </Link>
          <button
            onClick={() => void apply()}
            disabled={notEligible || !isOpen || applying || applied}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {applied ? "Applied" : applying ? "Applying..." : "Apply"}
          </button>
          {notEligible && <span className="text-xs text-rose-700 font-semibold">Apply is off: {fit.eligibility.flags.join("; ")}</span>}
          {!notEligible && !isOpen && <span className="text-xs text-slate-500 font-semibold">This opening is not accepting applications.</span>}
        </div>
        {applied && (
          <Notice tone="success">
            Application sent. <Link to="/dashboard/applications" className="underline font-bold">Track it in Applications</Link>.
          </Notice>
        )}
        {applyError && <Notice tone="error">{applyError}</Notice>}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card title="Skills for this role">
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-bold text-slate-500 mb-1">Required</p>
              {required.length ? skillChips(required) : <p className="text-xs text-slate-500">None listed.</p>}
            </div>
            {preferred.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-slate-500 mb-1">Preferred</p>
                skillChips(preferred)
              </div>
            )}
            <p className="text-[11px] text-slate-500">Green: demonstrated by your evidence. Amber: not demonstrated yet.</p>
          </div>
        </Card>

        <Card title="Eligibility rules">
          <ul className="text-xs text-slate-700 space-y-1.5">
            <li>
              <span className="font-bold">Minimum CGPA: </span>
              {job.minimumCgpa != null ? String(job.minimumCgpa) : "none"}
            </li>
            <li>
              <span className="font-bold">Branches: </span>
              {job.eligibleBranches.length ? job.eligibleBranches.map((b) => b.branch).join(", ") : "all"}
            </li>
            <li>
              <span className="font-bold">Batches: </span>
              {job.graduationYears.length ? job.graduationYears.map((y) => y.graduationYear).join(", ") : "all"}
            </li>
            <li>
              <span className="font-bold">Deadline: </span>
              {job.applicationDeadline ? new Date(job.applicationDeadline).toLocaleDateString() : "none"}
            </li>
          </ul>
        </Card>
      </div>

      {job.sources && job.sources.length > 0 && (
        <Card title={`Posted by ${job.sources.length} source${job.sources.length === 1 ? "" : "s"}`}>
          <ul className="text-xs text-slate-700 space-y-1">
            {job.sources.map((s, i) => (
              <li key={`${s.sourceType}-${i}`}>
                <span className="font-bold">{SOURCE_LABEL[s.sourceType]}</span>
                {s.sourceLabel ? `: ${s.sourceLabel}` : ""}
                {s.sourceUrl && (
                  <>
                    {" "}
                    <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                      link
                    </a>
                  </>
                )}
                <span className="text-slate-400"> · {new Date(s.importedAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
};
