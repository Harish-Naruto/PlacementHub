import React from "react";
import { Link } from "react-router-dom";
import { fetchPlacementStats } from "../../api/placement";
import { SOURCE_LABEL, STAGE_ORDER, type SourceType } from "../../api/types";
import { Empty, ErrorBox, Loading, PageHeader } from "../../components/common/Feedback";
import { card } from "../../components/placement/ui";
import { useQuery } from "../../components/placement/useQuery";

const STAGE_BAR: Record<string, string> = { Applied: "bg-blue-500", Interview: "bg-amber-500", Offer: "bg-emerald-500", Closed: "bg-slate-400" };

const StatCard: React.FC<{ label: string; value: number; hint: string }> = ({ label, value, hint }) => (
  <div className={card}>
    <p className="text-xs font-bold text-slate-500">{label}</p>
    <p className="text-3xl font-black text-slate-900 mt-1">{value}</p>
    <p className="text-[11px] text-slate-400 mt-1">{hint}</p>
  </div>
);

export const PlacementOverviewPage: React.FC = () => {
  const { data: stats, error, loading, reload: load } = useQuery(fetchPlacementStats);

  const totalApps = stats ? STAGE_ORDER.reduce((n, s) => n + (stats.applicationsByStage[s] ?? 0), 0) : 0;
  const maxStage = stats ? Math.max(1, ...STAGE_ORDER.map((s) => stats.applicationsByStage[s] ?? 0)) : 1;
  const sources = stats ? (Object.entries(stats.jobsBySource) as [SourceType, number][]).sort((a, b) => b[1] - a[1]) : [];
  const maxSource = Math.max(1, ...sources.map(([, n]) => n));

  return (
    <div className="space-y-6">
      <PageHeader title="Placement overview" subtitle="Openings from every source and applications from every institution, matched on evidence of skills." />
      {loading && <Loading />}
      <ErrorBox message={error} onRetry={load} />

      {stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Students" value={stats.students} hint="with a profile" />
            <StatCard label="Openings published" value={stats.jobs.PUBLISHED ?? 0} hint={`${Object.values(stats.jobs).reduce((a, b) => a + (b ?? 0), 0)} openings in total`} />
            <StatCard label="Seen in several sources" value={stats.jobsSeenInMultipleSources} hint="merged into one opening" />
            <StatCard label="Applications" value={totalApps} hint="across all openings" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={card}>
              <h3 className="text-sm font-black text-slate-900 mb-4">Application funnel</h3>
              {totalApps === 0 ? (
                <Empty title="No applications yet" hint="They appear here as students apply." />
              ) : (
                <ul className="space-y-3">
                  {STAGE_ORDER.map((s) => {
                    const n = stats.applicationsByStage[s] ?? 0;
                    return (
                      <li key={s}>
                        <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                          <span>{s}</span>
                          <span>{n}</span>
                        </div>
                        <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                          <div className={`h-full rounded-full ${STAGE_BAR[s]}`} style={{ width: `${(n / maxStage) * 100}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className={card}>
              <h3 className="text-sm font-black text-slate-900 mb-4">Openings by source</h3>
              {sources.length === 0 ? (
                <Empty title="No openings yet" hint="Ingest a posting to get started." />
              ) : (
                <ul className="space-y-3">
                  {sources.map(([src, n]) => (
                    <li key={src}>
                      <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                        <span>{SOURCE_LABEL[src] ?? src}</span>
                        <span>{n}</span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(n / maxSource) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { to: "/placement/ingest", title: "Ingest an opening", hint: "Paste a posting or pull from a job API" },
              { to: "/placement/rank", title: "Batch ranking", hint: "Rank a batch of students for one job" },
              { to: "/placement/pipeline", title: "Pipeline", hint: "Move applications through the stages" },
            ].map((l) => (
              <Link key={l.to} to={l.to} className={`${card} hover:border-emerald-400 hover:shadow-sm transition block`}>
                <p className="text-sm font-black text-emerald-700">{l.title}</p>
                <p className="text-xs text-slate-500 mt-1">{l.hint}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
