import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { changePlacementApplicationStatus, fetchPlacementApplication, fetchPlacementApplications, type PlacementApplication } from "../../api/placement";
import { FIXED_INSTITUTIONS } from "../../api/student";
import { allowedNext, STAGE_ORDER, STATUS_LABEL, type ApplicationStatus, type Stage } from "../../api/types";
import { FitBadge } from "../../components/common/FitBadge";
import { Empty, ErrorBox, Loading, PageHeader } from "../../components/common/Feedback";
import { StatusBadge } from "../../components/common/StatusBadge";
import { btnDanger, btnGhost, errMsg, input } from "../../components/placement/ui";
import { useQuery } from "../../components/placement/useQuery";

const COLUMN_TONE: Record<Stage, string> = { Applied: "border-t-blue-500", Interview: "border-t-amber-500", Offer: "border-t-emerald-500", Closed: "border-t-slate-400" };

const ApplicationModal: React.FC<{ id: string; onClose: () => void; onChanged: () => void }> = ({ id, onClose, onChanged }) => {
  const { accessToken } = useAuth();
  const fetcher = useCallback((t: string) => fetchPlacementApplication(t, id), [id]);
  const { data: detail, error, loading, reload: load } = useQuery(fetcher);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const move = async (status: ApplicationStatus) => {
    if (!accessToken) return;
    setBusy(true);
    setActionError(null);
    try {
      await changePlacementApplicationStatus(accessToken, id, status, note.trim() || undefined);
      setNote("");
      onChanged();
      load();
    } catch (e) {
      setActionError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const next = detail ? allowedNext(detail.status) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Application details" onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900">{detail ? (detail.studentProfile.user.name ?? detail.studentProfile.user.email) : "Application"}</h3>
            {detail && (
              <p className="text-xs text-slate-500">
                {detail.jobPosting.title}
                {detail.jobPosting.company ? ` at ${detail.jobPosting.company.name}` : ""}
              </p>
            )}
          </div>
          <button onClick={onClose} className={btnGhost} aria-label="Close">
            Close
          </button>
        </div>

        {loading && !detail && <Loading />}
        <ErrorBox message={error} onRetry={load} />

        {detail && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={detail.status} type="application" />
              <span className="text-xs font-bold text-slate-600">{STATUS_LABEL[detail.status]}</span>
              <span className="text-[11px] text-slate-500">Fit at apply</span>
              <FitBadge score={detail.fitScore} />
            </div>
            <p className="text-[11px] text-slate-500">
              {[detail.studentProfile.branch, detail.studentProfile.cgpa != null ? `CGPA ${detail.studentProfile.cgpa}` : null, detail.studentProfile.graduationYear ? `Batch ${detail.studentProfile.graduationYear}` : null].filter(Boolean).join(" / ")}
              {" "}
              {detail.studentProfile.user.email}
            </p>

            <div>
              <p className="text-xs font-bold text-slate-600 mb-2">Timeline</p>
              <ol className="space-y-2 border-l-2 border-slate-100 pl-4">
                {detail.events.map((ev) => (
                  <li key={ev.id} className="relative">
                    <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <p className="text-xs font-bold text-slate-800">{STATUS_LABEL[ev.toStatus]}</p>
                    <p className="text-[11px] text-slate-500">
                      {ev.actor ? `${ev.actor.name ?? "Unknown"} (${ev.actor.role.toLowerCase()})` : "System"} on {new Date(ev.createdAt).toLocaleDateString()}
                    </p>
                    {ev.note && <p className="text-xs text-slate-600 mt-0.5">{ev.note}</p>}
                  </li>
                ))}
              </ol>
            </div>

            {next.length > 0 ? (
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <label htmlFor="pl-note" className="block text-xs font-bold text-slate-600">
                  Move to (optional note)
                </label>
                <input id="pl-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Note for the timeline" className={input} />
                <div className="flex flex-wrap gap-2">
                  {next.map((s) => (
                    <button key={s} disabled={busy} onClick={() => void move(s)} className={s === "REJECTED" ? btnDanger : btnGhost}>
                      {s === "REJECTED" ? "Reject" : STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
                <ErrorBox message={actionError} />
              </div>
            ) : (
              <p className="text-xs text-slate-500 border-t border-slate-100 pt-4">This application is final, so it cannot move any further.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export const PlacementPipelinePage: React.FC = () => {
  const [institutionId, setInstitutionId] = useState("");
  const [jobId, setJobId] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const fetcher = useCallback((t: string) => fetchPlacementApplications(t, { institutionId }), [institutionId]);
  const { data, error, loading, reload: load } = useQuery(fetcher);

  const visible = useMemo(() => (data ?? []).filter((a: PlacementApplication) => !jobId || a.jobPosting.id === jobId), [data, jobId]);
  const jobOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of data ?? []) m.set(a.jobPosting.id, `${a.jobPosting.title}${a.jobPosting.company ? ` - ${a.jobPosting.company.name}` : ""}`);
    return [...m.entries()];
  }, [data]);

  return (
    <div className="space-y-6">
      <PageHeader title="Pipeline" subtitle="Every application on one board. Open a card to see its history and move it to the next stage." />
      <div className="flex flex-wrap gap-3">
        <select value={jobId} onChange={(e) => setJobId(e.target.value)} aria-label="Filter by opening" className={`${input} max-w-xs`}>
          <option value="">All openings</option>
          {jobOptions.map(([id, text]) => (
            <option key={id} value={id}>
              {text}
            </option>
          ))}
        </select>
        <select value={institutionId} onChange={(e) => setInstitutionId(e.target.value)} aria-label="Filter by institution" className={`${input} max-w-xs`}>
          <option value="">All institutions</option>
          {FIXED_INSTITUTIONS.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </div>

      <ErrorBox message={error} onRetry={load} />
      {loading && <Loading />}
      {!loading && !error && visible.length === 0 && <Empty title="No applications yet" hint="Applications appear here when students apply, or change the filters." />}

      {visible.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {STAGE_ORDER.map((stage) => {
            const cards = visible.filter((a) => a.stage === stage);
            return (
              <section key={stage} className={`bg-slate-100/70 rounded-2xl border-t-4 ${COLUMN_TONE[stage]} p-3 space-y-3`} aria-label={stage}>
                <h3 className="flex items-center justify-between text-xs font-black text-slate-700 px-1">
                  <span>{stage}</span>
                  <span className="px-2 py-0.5 rounded-full bg-white text-slate-600">{cards.length}</span>
                </h3>
                {cards.length === 0 && <p className="text-[11px] text-slate-400 px-1 py-4 text-center">Nothing here</p>}
                {cards.map((a) => (
                  <button key={a.id} onClick={() => setOpenId(a.id)} className="block w-full text-left bg-white rounded-xl border border-slate-200 p-3 hover:border-emerald-400 hover:shadow-sm transition space-y-1.5">
                    <p className="text-xs font-black text-slate-900">{a.studentProfile.user.name ?? a.studentProfile.user.email}</p>
                    <p className="text-[11px] text-slate-600">
                      {a.jobPosting.title}
                      {a.jobPosting.company ? ` at ${a.jobPosting.company.name}` : ""}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={a.status} type="application" />
                      <FitBadge score={a.fitScore} />
                    </div>
                    <p className="text-[10px] text-slate-400">Updated {new Date(a.updatedAt).toLocaleDateString()}</p>
                  </button>
                ))}
              </section>
            );
          })}
        </div>
      )}

      {openId && <ApplicationModal id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
};
