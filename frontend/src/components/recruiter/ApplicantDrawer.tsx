import React, { useCallback, useEffect } from "react";
import { changeApplicantStatus, fetchApplicantDetail } from "../../api/recruiterPortal";
import type { ApplicantDetail } from "../../api/recruiterPortal";
import { STATUS_LABEL } from "../../api/types";
import type { ApplicationStatus } from "../../api/types";
import { useAuth } from "../../context/AuthContext";
import { ErrorBox, Loading } from "../common/Feedback";
import { FitBadge } from "../common/FitBadge";
import { StatusBadge } from "../common/StatusBadge";
import { GAP_COPY, errorMessage } from "./helpers";
import { ResumeSnapshotView } from "./ResumeSnapshotView";
import { StatusControls } from "./StatusControls";
import { useApi } from "./useApi";

const SKILL_STATUS: Record<string, { label: string; cls: string }> = {
  EVALUATED: { label: "Verified", cls: "bg-emerald-50 text-emerald-800 border-emerald-300" },
  REPOSITORY_OBSERVED: { label: "Observed in code", cls: "bg-blue-50 text-blue-800 border-blue-300" },
  NEEDS_REVIEW: { label: "Needs review", cls: "bg-amber-50 text-amber-800 border-amber-300" },
  SELF_DECLARED: { label: "Self-declared", cls: "bg-slate-50 text-slate-700 border-slate-300" },
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-2">
    <h4 className="text-xs font-black text-slate-900">{title}</h4>
    {children}
  </section>
);

const pct = (n: number | null) => (n == null ? "-" : `${n}%`);

const SkillsTable: React.FC<{ skills: ApplicantDetail["skills"] }> = ({ skills }) => {
  if (skills.length === 0) return <p className="text-xs text-slate-400">No skills on this profile yet.</p>;
  return (
    <div className="overflow-x-auto border border-slate-200 rounded-xl">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-slate-500 text-left">
          <tr>
            <th className="px-3 py-2 font-bold">Skill</th>
            <th className="px-3 py-2 font-bold">Status</th>
            <th className="px-3 py-2 font-bold">Assessment</th>
            <th className="px-3 py-2 font-bold">GitHub</th>
            <th className="px-3 py-2 font-bold">Combined</th>
            <th className="px-3 py-2 font-bold">Proof</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {skills.map((s) => {
            const st = SKILL_STATUS[s.status] ?? { label: s.status, cls: "bg-slate-50 text-slate-700 border-slate-300" };
            return (
              <tr key={s.skill} className="align-top">
                <td className="px-3 py-2 font-bold text-slate-800">{s.skill}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap ${st.cls}`}>{st.label}</span>
                </td>
                <td className="px-3 py-2">{pct(s.assessmentScore)}</td>
                <td className="px-3 py-2">{pct(s.githubScore)}</td>
                <td className="px-3 py-2 font-bold">{s.combinedScore ?? "-"}</td>
                <td className="px-3 py-2 min-w-48">
                  {s.proof.length === 0 ? (
                    <span className="text-slate-400">No proof yet</span>
                  ) : (
                    <ul className="space-y-1">
                      {s.proof.map((p) => (
                        <li key={`${p.sourceType}-${p.sourceUrl}`}>
                          {p.sourceUrl && /^https?:\/\//.test(p.sourceUrl) ? (
                            <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="text-purple-700 font-semibold hover:underline break-all">
                              {p.description || "GitHub proof"}
                            </a>
                          ) : (
                            <span className="text-slate-600">{p.description || (p.sourceType === "ASSESSMENT" ? "Assessment result" : p.sourceType)}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

interface ApplicantDrawerProps {
  applicationId: string;
  onClose: () => void;
  /** Called after a status change so the table behind the drawer can refetch. */
  onChanged: () => void;
}

export const ApplicantDrawer: React.FC<ApplicantDrawerProps> = ({ applicationId, onClose, onChanged }) => {
  const { accessToken } = useAuth();
  const load = useCallback((token: string) => fetchApplicantDetail(token, applicationId), [applicationId]);
  const { data, error, loading, reload } = useApi(load);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const change = async (to: ApplicationStatus, note: string) => {
    if (!accessToken) throw new Error("You are signed out. Please sign in again.");
    await changeApplicantStatus(accessToken, applicationId, to, note || undefined);
    reload();
    onChanged();
  };

  const detail = data && data.application.id === applicationId ? data : undefined;
  const app = detail?.application;
  const fit = detail?.fitNow;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label="Applicant details">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <aside className="relative w-full max-w-2xl h-full bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-3 bg-white border-b border-slate-200">
          <h3 className="text-sm font-black text-slate-900">Applicant details</h3>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200">
            Close
          </button>
        </div>

        <div className="p-5 space-y-6">
          {loading && !detail && <Loading />}
          {error !== undefined && <ErrorBox message={errorMessage(error)} onRetry={reload} />}

          {detail && app && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-900">{app.studentProfile.user.name ?? app.studentProfile.user.email}</h2>
                  <p className="text-xs text-slate-500">{app.studentProfile.user.email}</p>
                  <p className="text-xs text-slate-600 mt-1">
                    {[app.studentProfile.branch, app.studentProfile.cgpa != null ? `CGPA ${app.studentProfile.cgpa}` : null, app.studentProfile.graduationYear ? `Batch ${app.studentProfile.graduationYear}` : null].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Applied for {app.jobPosting.title} on {new Date(app.appliedAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={app.status} type="application" />
              </div>

              <Section title="Fit">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                    <p className="text-[11px] font-bold text-slate-500">Fit now</p>
                    {fit ? (
                      <>
                        <FitBadge score={fit.fitScore} band={fit.band} />
                        <p className="text-[11px] text-slate-500">
                          {fit.requiredDemonstrated} of {fit.requiredTotal} required skills demonstrated
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-slate-400">Not available</p>
                    )}
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                    <p className="text-[11px] font-bold text-slate-500">Fit when they applied</p>
                    <FitBadge score={detail.fitAtApply.score} />
                  </div>
                </div>
                {fit && (
                  <>
                    <p className="text-xs text-slate-700">{fit.explanation}</p>
                    {fit.eligibility.flags.length > 0 && (
                      <p className="text-xs font-semibold text-rose-700">Not eligible: {fit.eligibility.flags.join("; ")}</p>
                    )}
                    {fit.gaps.length > 0 && (
                      <ul className="space-y-1">
                        {fit.gaps.map((g) => (
                          <li key={g.skill} className="text-xs text-slate-700">
                            <span className={`font-bold ${g.requirement === "REQUIRED" ? "text-rose-700" : "text-amber-700"}`}>{g.skill}</span>
                            <span className="text-slate-400"> ({g.requirement === "REQUIRED" ? "required" : "preferred"})</span> - {GAP_COPY[g.kind] ?? g.detail}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </Section>

              <Section title="Skills with proof">
                <SkillsTable skills={detail.skills} />
              </Section>

              <Section title="Resume sent">
                {detail.resumeSnapshot ? <ResumeSnapshotView snapshot={detail.resumeSnapshot} /> : <p className="text-xs text-slate-400">No resume was attached to this application.</p>}
              </Section>

              <Section title="Status history">
                <ol className="space-y-2 border-l-2 border-slate-200 pl-4">
                  {app.events.map((ev) => (
                    <li key={ev.id} className="text-xs">
                      <p className="font-bold text-slate-800">
                        {ev.fromStatus ? `${STATUS_LABEL[ev.fromStatus]} → ` : ""}
                        {STATUS_LABEL[ev.toStatus]}
                      </p>
                      {ev.note && <p className="text-slate-600">{ev.note}</p>}
                      <p className="text-[11px] text-slate-400">
                        {ev.actor ? `${ev.actor.name ?? "Unknown"} (${ev.actor.role.toLowerCase()})` : "System"} · {new Date(ev.createdAt).toLocaleDateString()}
                      </p>
                    </li>
                  ))}
                </ol>
              </Section>

              <Section title="Change status">
                <StatusControls status={app.status} onChange={change} expanded />
              </Section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
};
