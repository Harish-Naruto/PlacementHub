import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { fetchPlacementJobs, patchPlacementJobSkills, setPlacementJobStatus, type PlacementJob } from "../../api/placement";
import { preferredSkills, requiredSkills, SOURCE_LABEL } from "../../api/types";
import { Empty, ErrorBox, Loading, PageHeader } from "../../components/common/Feedback";
import { ChipEditor } from "../../components/placement/ChipEditor";
import { JobStatusBadge, ParseBadge, SkillChips } from "../../components/placement/shared";
import { btnDanger, btnGhost, btnPrimary, card, errMsg, input, useDebounced } from "../../components/placement/ui";
import { useQuery } from "../../components/placement/useQuery";

const sourceText = (s: PlacementJob["sources"][number]) => `${SOURCE_LABEL[s.sourceType]}${s.sourceLabel ? `: ${s.sourceLabel}` : ""}`;

const JobDetail: React.FC<{ job: PlacementJob; onChanged: () => void }> = ({ job, onChanged }) => {
  const { accessToken } = useAuth();
  const [required, setRequired] = useState(() => requiredSkills(job));
  const [preferred, setPreferred] = useState(() => preferredSkills(job));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty = JSON.stringify(required) !== JSON.stringify(requiredSkills(job)) || JSON.stringify(preferred) !== JSON.stringify(preferredSkills(job));

  const run = async (fn: () => Promise<PlacementJob>, okText: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const updated = await fn();
      onChanged();
      setRequired(requiredSkills(updated));
      setPreferred(preferredSkills(updated));
      setMessage({ ok: true, text: okText });
    } catch (e) {
      setMessage({ ok: false, text: errMsg(e) });
    } finally {
      setBusy(false);
    }
  };

  const setStatus = (action: "publish" | "pause" | "close") => {
    if (!accessToken) return;
    if (action === "close" && !window.confirm("Close this opening? A closed opening cannot be reopened.")) return;
    void run(() => setPlacementJobStatus(accessToken, job.id, action), action === "publish" ? "Opening published." : action === "pause" ? "Opening paused." : "Opening closed.");
  };

  return (
    <div className="bg-slate-50 border-t border-slate-100 p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChipEditor label="Required skills" values={required} onChange={setRequired} disabled={busy} />
        <ChipEditor label="Preferred skills" values={preferred} onChange={setPreferred} disabled={busy} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          disabled={busy || !dirty || !accessToken}
          onClick={() => accessToken && void run(() => patchPlacementJobSkills(accessToken, job.id, { required, preferred }), "Skills saved. Names are normalised, so ReactJS and React.js become React.")}
          className={btnPrimary}
        >
          {busy ? "Working..." : "Save skills"}
        </button>
        {job.status !== "PUBLISHED" && job.status !== "CLOSED" && (
          <button disabled={busy} onClick={() => setStatus("publish")} className={btnGhost}>
            Publish
          </button>
        )}
        {job.status === "PUBLISHED" && (
          <button disabled={busy} onClick={() => setStatus("pause")} className={btnGhost}>
            Pause
          </button>
        )}
        {job.status !== "CLOSED" && (
          <button disabled={busy} onClick={() => setStatus("close")} className={btnDanger}>
            Close
          </button>
        )}
        <Link to={`/placement/rank?jobId=${job.id}`} className="ml-auto text-xs font-bold text-emerald-700 hover:underline">
          Rank students for this job
        </Link>
      </div>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-xs font-semibold p-2.5 rounded-xl border ${message.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>
          {message.text}
        </p>
      )}
      {job.sources.length > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-600 mb-1">Seen from</p>
          <ul className="text-[11px] text-slate-600 space-y-0.5">
            {job.sources.map((s, i) => (
              <li key={`${s.sourceType}-${i}`}>
                {sourceText(s)} <span className="text-slate-400">({new Date(s.importedAt).toLocaleDateString()})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export const PlacementJobsPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const debounced = useDebounced(search);
  const [open, setOpen] = useState<string | null>(null);
  const term = debounced.trim();
  const fetcher = useCallback((t: string) => fetchPlacementJobs(t, { status, search: term }), [status, term]);
  const { data, error, loading, reload: load } = useQuery(fetcher);
  const jobs = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Openings"
        subtitle="Every opening from every source. An opening seen from several sources is shown once."
        actions={
          <Link to="/placement/ingest" className={btnPrimary}>
            Ingest an opening
          </Link>
        }
      />
      <div className="flex flex-wrap gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title or company" aria-label="Search openings" className={`${input} max-w-xs`} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status" className={`${input} max-w-[10rem]`}>
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="PAUSED">Paused</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      <ErrorBox message={error} onRetry={load} />
      {loading && <Loading />}
      {!loading && !error && jobs.length === 0 && <Empty title="No openings found" hint="Try another filter, or ingest an opening." />}

      <div className="space-y-3">
        {jobs.map((j) => {
          const expanded = open === j.id;
          return (
            <div key={j.id} className={`${card} !p-0 overflow-hidden`}>
              <button type="button" onClick={() => setOpen(expanded ? null : j.id)} aria-expanded={expanded} className="w-full text-left p-4 hover:bg-slate-50 transition">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-black text-slate-900">{j.title}</h3>
                  <JobStatusBadge status={j.status} />
                  <span
                    title={j.sources.map(sourceText).join("\n")}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${j.sourceCount > 1 ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}
                  >
                    {j.sourceCount} {j.sourceCount === 1 ? "source" : "sources"}
                  </span>
                  <ParseBadge method={j.parseMethod} />
                  <span className="ml-auto text-[11px] font-bold text-slate-500">{j._count.applications} applicant{j._count.applications === 1 ? "" : "s"}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {j.company?.name ?? "Unknown company"}
                  {j.location ? `, ${j.location}` : ""}
                </p>
                {j.sources.length > 0 && <p className="text-[11px] text-slate-400 mt-0.5">{j.sources.map(sourceText).join(" / ")}</p>}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  <SkillChips names={requiredSkills(j)} tone="required" empty="No required skills" />
                  <SkillChips names={preferredSkills(j)} tone="preferred" empty="" />
                </div>
              </button>
              {expanded && <JobDetail job={j} onChanged={load} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};
