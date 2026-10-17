import React, { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { buildResumeForJob, errorCode, errorMessage, fetchResumeChoices } from "../../api/match";
import type { LedgerEntry, ProofRef, ResumeBullet } from "../../api/types";
import { FitBadge } from "../../components/common/FitBadge";
import { ErrorBox, Loading } from "../../components/common/Feedback";
import { Card, Chip, Notice, type ChipTone } from "../../components/student/Chip";
import { BLOCKED_KIND_LABEL } from "../../components/student/labels";
import { useApply } from "../../components/student/useApply";
import { useAsync } from "../../components/student/useAsync";

const LEDGER_STATUS: Record<LedgerEntry["status"], { label: string; tone: ChipTone }> = {
  verified: { label: "Verified", tone: "green" },
  self_reported: { label: "Self-reported", tone: "slate" },
  blocked: { label: "Blocked", tone: "rose" },
  dropped_for_space: { label: "Dropped for space", tone: "amber" },
};

const ProofLinks: React.FC<{ proof: ProofRef[] }> = ({ proof }) =>
  proof.length === 0 ? (
    <p className="text-xs text-slate-500">No proof attached.</p>
  ) : (
    <ul className="text-xs text-slate-600 space-y-0.5">
      {proof.map((p, i) => (
        <li key={`${p.label}-${i}`}>
          <span className="text-slate-400">{p.kind}: </span>
          {p.url ? (
            <a href={p.url} target="_blank" rel="noreferrer" className="text-blue-600 font-semibold hover:underline">
              {p.label}
            </a>
          ) : (
            p.label
          )}
        </li>
      ))}
    </ul>
  );

const BulletProof: React.FC<{ bullet: ResumeBullet }> = ({ bullet }) => (
  <li className="py-2 border-b border-slate-100 last:border-0">
    <div className="flex items-start gap-2">
      <Chip tone={bullet.tier === "verified" ? "green" : "slate"}>{bullet.tier === "verified" ? "Verified" : "Self-reported"}</Chip>
      <p className="text-xs text-slate-800 flex-1 min-w-0">{bullet.text}</p>
    </div>
    <details className="mt-1 ml-1">
      <summary className="text-[11px] font-bold text-blue-600 cursor-pointer">Evidence ({bullet.proof.length})</summary>
      <div className="mt-1 pl-3">
        <ProofLinks proof={bullet.proof} />
      </div>
    </details>
  </li>
);

export const ResumeBuilderPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const { accessToken } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [resumeId, setResumeId] = useState("");
  const { applying, applied, error: applyError, apply } = useApply(accessToken, jobId);

  const gen = useAsync(async () => {
    if (!accessToken || !jobId) throw new Error("Please sign in again.");
    return buildResumeForJob(accessToken, jobId, resumeId || undefined);
  }, `${jobId}|${resumeId}`);
  const choices = useAsync(async () => (accessToken ? fetchResumeChoices(accessToken) : []), "choices");

  const { data, loading, reload: generate } = gen;
  const resumes = choices.data ?? [];
  const error = gen.error ? { message: errorMessage(gen.error, "Could not build the resume."), code: errorCode(gen.error) } : null;

  const resume = data?.resume;
  const bulletGroups = resume
    ? [
        ...(resume.summary ? [{ title: "Summary", bullets: [resume.summary] }] : []),
        ...resume.projects.filter((p) => p.bullets.length > 0).map((p) => ({ title: `Project: ${p.title}`, bullets: p.bullets })),
        ...resume.experience.filter((x) => x.bullets.length > 0).map((x) => ({ title: `Experience: ${x.title ? `${x.title}, ` : ""}${x.organization}`, bullets: x.bullets })),
      ]
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to={jobId ? `/dashboard/jobs/${jobId}` : "/dashboard/jobs"} className="text-xs font-bold text-blue-600 hover:underline">
            ← Back to the opening
          </Link>
          <h1 className="text-xl font-black text-slate-900 tracking-tight mt-1">Tailored resume</h1>
          {resume && (
            <p className="text-xs text-slate-500 mt-0.5">
              For {resume.job.title}
              {resume.job.company ? ` at ${resume.job.company}` : ""}. Every line is backed by your evidence.
            </p>
          )}
        </div>
        {resumes.length > 1 && (
          <label className="text-xs font-bold text-slate-600 flex flex-col gap-1">
            Based on uploaded resume
            <select
              value={resumeId}
              onChange={(e) => setResumeId(e.target.value)}
              disabled={loading}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
            >
              <option value="">Latest</option>
              {resumes.map((r, i) => (
                <option key={r.id} value={r.id}>
                  Resume {i + 1} ({new Date(r.createdAt).toLocaleDateString()})
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error?.code === "PROFILE_REQUIRED" ? (
        <Notice tone="info">
          {error.message}{" "}
          <Link to="/dashboard/profile" className="underline font-bold">
            Complete your profile
          </Link>{" "}
          and try again.
        </Notice>
      ) : (
        <ErrorBox message={error?.message ?? null} onRetry={generate} />
      )}

      {loading && <Loading label="Building your resume..." />}

      {!loading && data && resume && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,820px)_minmax(0,1fr)] gap-5 items-start">
          <div className="space-y-3 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-600">
                One page: {resume.stats.lines} of {resume.stats.maxLines} lines used
                {resume.stats.droppedForSpace > 0 && ` (${resume.stats.droppedForSpace} dropped for space)`}
              </p>
              <button onClick={() => iframeRef.current?.contentWindow?.print()} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold">
                Print / Save as PDF
              </button>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100 p-2 sm:p-4">
              <iframe
                ref={iframeRef}
                title="Tailored resume preview"
                srcDoc={data.html}
                sandbox="allow-same-origin allow-modals"
                className="block bg-white shadow-md mx-auto"
                style={{ width: 794, height: 1123, border: 0 }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => void apply()}
                disabled={applying || applied}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
              >
                {applied ? "Applied" : applying ? "Applying..." : "Apply with this resume"}
              </button>
              {applied && (
                <Notice tone="success">
                  Application sent. <Link to="/dashboard/applications" className="underline font-bold">Track it in Applications</Link>.
                </Notice>
              )}
              {applyError && <Notice tone="error">{applyError}</Notice>}
            </div>
          </div>

          <div className="space-y-5 min-w-0">
            <Card title="Fit for this opening">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <FitBadge score={data.fit.fitScore} band={data.fit.band} />
                <span className="text-xs text-slate-500">
                  {data.fit.requiredDemonstrated} of {data.fit.requiredTotal} required skills demonstrated
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">{data.fit.explanation}</p>
            </Card>

            <Card title="Not on this resume">
              <p className="text-xs text-slate-600 mb-3">These claims have no supporting evidence yet, so they were left out.</p>
              {resume.blocked.length === 0 ? (
                <p className="text-xs text-emerald-700 font-semibold">Nothing was left out.</p>
              ) : (
                <ul className="space-y-2">
                  {resume.blocked.map((b, i) => (
                    <li key={`${b.claim}-${i}`} className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{b.claim}</span>
                        <Chip tone="amber">{BLOCKED_KIND_LABEL[b.kind]}</Chip>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{b.reason}</p>
                      <p className="text-xs text-slate-800 mt-1">
                        <span className="font-bold">How to fix: </span>
                        {b.action}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {bulletGroups.length > 0 && (
              <Card title="Lines and their proof">
                <div className="space-y-3">
                  {bulletGroups.map((g) => (
                    <div key={g.title}>
                      <p className="text-[11px] font-bold text-slate-500">{g.title}</p>
                      <ul>
                        {g.bullets.map((b, i) => (
                          <BulletProof key={`${b.factIds.join("-")}-${i}`} bullet={b} />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {!loading && resume && (
        <Card title="Where every line comes from">
          {resume.ledger.length === 0 ? (
            <p className="text-xs text-slate-500">No entries.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-3 font-bold">Line</th>
                    <th className="py-2 pr-3 font-bold whitespace-nowrap">Status</th>
                    <th className="py-2 font-bold">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {resume.ledger.map((l, i) => (
                    <tr key={`${l.factId}-${i}`} className="border-b border-slate-100 align-top">
                      <td className="py-2 pr-3 text-slate-800 min-w-48">{l.text}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <Chip tone={LEDGER_STATUS[l.status].tone}>{LEDGER_STATUS[l.status].label}</Chip>
                      </td>
                      <td className="py-2 text-slate-600 min-w-48">{l.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
