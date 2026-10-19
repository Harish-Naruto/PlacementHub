import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ingestFromApi, ingestPaste, type ApiIngestSummary, type DuplicateKind, type IngestResult, type PasteSourceType } from "../../api/placement";
import { ApiRequestError } from "../../api/http";
import { ErrorBox, PageHeader } from "../../components/common/Feedback";
import { Field, ParseBadge, SkillChips } from "../../components/placement/shared";
import { btnPrimary, card, errMsg, input, td, th } from "../../components/placement/ui";

const DUPLICATE_COPY = (kind: DuplicateKind, similarity: number) =>
  kind === "exact"
    ? "Exact match: same company, role and city."
    : kind === "fuzzy"
      ? `Fuzzy match: ${similarity}% similar to an existing opening.`
      : "Same source: this exact message was already imported.";

const ResultCard: React.FC<{ result: IngestResult }> = ({ result }) => (
  <div className={`mt-5 rounded-2xl border p-4 ${result.created ? "bg-emerald-50 border-emerald-200" : "bg-blue-50 border-blue-200"}`} role="status">
    <p className={`text-sm font-black ${result.created ? "text-emerald-800" : "text-blue-800"}`}>{result.created ? "New opening created" : "Matched an opening we already had"}</p>
    {result.duplicate && <p className="text-xs text-slate-700 mt-1">{DUPLICATE_COPY(result.duplicate.kind, result.duplicate.similarity)}</p>}
    <p className="text-xs text-slate-700 mt-1 flex flex-wrap items-center gap-2">
      <span>
        Now seen from <b>{result.sourceCount}</b> {result.sourceCount === 1 ? "source" : "sources"}.
      </span>
      <ParseBadge method={result.parseMethod} />
    </p>
    <div className="mt-3 space-y-2">
      <div>
        <p className="text-[11px] font-bold text-slate-500 mb-1">Required skills</p>
        <SkillChips names={result.skills.required} tone="required" empty="None found" />
      </div>
      <div>
        <p className="text-[11px] font-bold text-slate-500 mb-1">Preferred skills</p>
        <SkillChips names={result.skills.preferred} tone="preferred" empty="None found" />
      </div>
    </div>
    <Link to="/placement/jobs" className="inline-block mt-3 text-xs font-bold text-emerald-700 hover:underline">
      View in openings
    </Link>
  </div>
);

const PasteSection: React.FC = () => {
  const { accessToken } = useAuth();
  const [text, setText] = useState("");
  const [sourceType, setSourceType] = useState<PasteSourceType>("PARTNER_POSTING");
  const [sourceLabel, setSourceLabel] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needCompany, setNeedCompany] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);
  const companyRef = useRef<HTMLInputElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    setNeedCompany(false);
    setResult(null);
    try {
      setResult(
        await ingestPaste(accessToken, {
          text,
          sourceType,
          sourceLabel: sourceLabel.trim() || undefined,
          company: company.trim() || undefined,
          title: title.trim() || undefined,
          location: location.trim() || undefined,
        }),
      );
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "COMPANY_REQUIRED") {
        setNeedCompany(true);
        setTimeout(() => companyRef.current?.focus(), 0);
      } else setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={card}>
      <h3 className="text-sm font-black text-slate-900">Paste a posting</h3>
      <p className="text-xs text-slate-500 mt-1 mb-4">A WhatsApp message or an alumni referral is fine. We read the skills, merge it with openings we already have, and keep every source.</p>
      <div className="space-y-4">
        <Field label="Posting text" htmlFor="ing-text" hint="At least 20 characters.">
          <textarea id="ing-text" required minLength={20} rows={8} value={text} onChange={(e) => setText(e.target.value)} className={input} placeholder="Paste the full posting here" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Source type" htmlFor="ing-type">
            <select id="ing-type" value={sourceType} onChange={(e) => setSourceType(e.target.value as PasteSourceType)} className={input}>
              <option value="PARTNER_POSTING">Partner posting</option>
              <option value="ALUMNI_REFERRAL">Alumni referral</option>
            </select>
          </Field>
          <Field label="Source label (optional)" htmlFor="ing-label">
            <input id="ing-label" value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} maxLength={120} className={input} placeholder="Partner: Acme HR, or Alumni: Ravi (COEP 2021)" />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Company (optional)" htmlFor="ing-company">
            <input
              id="ing-company"
              ref={companyRef}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              maxLength={200}
              aria-invalid={needCompany}
              className={`${input} ${needCompany ? "border-amber-400 ring-2 ring-amber-300 bg-amber-50" : ""}`}
              placeholder="Overrides what we read"
            />
          </Field>
          <Field label="Title (optional)" htmlFor="ing-title">
            <input id="ing-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={input} />
          </Field>
          <Field label="Location (optional)" htmlFor="ing-loc">
            <input id="ing-loc" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} className={input} />
          </Field>
        </div>
        {needCompany && (
          <div role="alert" className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold">
            We could not find the company name in this posting. Add it in the Company field above and submit again.
          </div>
        )}
        <ErrorBox message={error} />
        <button type="submit" disabled={busy || text.trim().length < 20} className={btnPrimary}>
          {busy ? "Reading posting..." : "Submit posting"}
        </button>
      </div>
      {result && <ResultCard result={result} />}
    </form>
  );
};

const OUTCOME: Record<string, string> = { created: "bg-emerald-100 text-emerald-800", merged: "bg-blue-100 text-blue-800", skipped: "bg-slate-100 text-slate-600" };

const ApiSection: React.FC = () => {
  const { accessToken } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ApiIngestSummary | null>(null);

  const run = async () => {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      setSummary(await ingestFromApi(accessToken, "remotive"));
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={card}>
      <h3 className="text-sm font-black text-slate-900">Pull from a job API</h3>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
        <div>
          <p className="text-xs font-black text-slate-800">Remotive</p>
          <p className="text-[11px] text-slate-500">Remote software openings. Jobs from Remotive.</p>
        </div>
        <button onClick={run} disabled={busy} className={btnPrimary}>
          {busy ? "Fetching..." : "Fetch openings"}
        </button>
      </div>
      <div className="mt-3">
        <ErrorBox message={error} />
      </div>

      {summary && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`px-2.5 py-0.5 rounded-full font-bold ${summary.dataSource === "api" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{summary.dataSource === "api" ? "Live API" : "Offline sample data"}</span>
            <span className="text-slate-600">
              Fetched <b>{summary.fetched}</b>, new <b>{summary.created}</b>, merged into existing <b>{summary.merged}</b>, already imported <b>{summary.skipped}</b>
            </span>
          </div>
          {summary.results.length > 0 && (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className={th}>Title</th>
                    <th className={th}>Company</th>
                    <th className={th}>Outcome</th>
                    <th className={th}>Match</th>
                    <th className={th}>Sources</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.results.map((r, i) => {
                    const outcome = r.created ? "created" : r.duplicate?.kind === "same_source" ? "skipped" : "merged";
                    return (
                      <tr key={`${r.jobId}-${i}`}>
                        <td className={`${td} font-bold text-slate-900`}>{r.title ?? "Untitled"}</td>
                        <td className={td}>{r.company ?? "-"}</td>
                        <td className={td}>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${OUTCOME[outcome]}`}>{outcome}</span>
                        </td>
                        <td className={td}>{r.duplicate ? `${r.duplicate.kind.replace("_", " ")} (${r.duplicate.similarity}%)` : "-"}</td>
                        <td className={td}>{r.sourceCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {summary.errors.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <p className="font-bold mb-1">{summary.errors.length} could not be imported</p>
              <ul className="list-disc ml-4 space-y-0.5">
                {summary.errors.map((e, i) => (
                  <li key={`${e.externalId}-${i}`}>
                    {e.externalId ? `${e.externalId}: ` : ""}
                    {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Link to="/placement/jobs" className="inline-block text-xs font-bold text-emerald-700 hover:underline">
            View in openings
          </Link>
        </div>
      )}
    </div>
  );
};

export const PlacementIngestPage: React.FC = () => (
  <div className="space-y-6">
    <PageHeader title="Ingest openings" subtitle="Bring openings in from partners, alumni and job APIs. The same opening arriving twice is merged, not duplicated." />
    <PasteSection />
    <ApiSection />
  </div>
);
