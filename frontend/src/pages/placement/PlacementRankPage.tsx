import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { fetchPlacementJobs, rankBatch, type RankFilter, type RankResponse, type RankRow } from "../../api/placement";
import { ApiRequestError } from "../../api/http";
import { FIXED_INSTITUTIONS } from "../../api/student";
import { FitBadge, FitBar } from "../../components/common/FitBadge";
import { Empty, ErrorBox, PageHeader } from "../../components/common/Feedback";
import { Field, GapChip, ParseBadge, SkillChip, SkillChips } from "../../components/placement/shared";
import { btnGhost, btnPrimary, card, errMsg, input, td, th } from "../../components/placement/ui";
import { useQuery } from "../../components/placement/useQuery";

const fetchAllJobs = (token: string) => fetchPlacementJobs(token);

type Mode = "paste" | "existing";

const csvCell = (v: string | number | boolean | null | undefined) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function downloadCsv(rows: RankRow[], title: string) {
  const head = ["Rank", "Name", "Email", "Institution", "Branch", "CGPA", "Batch", "Fit", "Band", "Eligible", "Required met", "Matched skills", "Gaps"];
  const lines = rows.map((r) =>
    [
      r.rank,
      r.name,
      r.email,
      r.institution,
      r.branch,
      r.cgpa,
      r.graduationYear,
      r.fitScore,
      r.band,
      r.eligible ? "yes" : "no",
      r.requiredTotal ? `${r.requiredDemonstrated}/${r.requiredTotal}` : "",
      r.matched.map((m) => `${m.skill}${m.combinedScore != null ? ` (${m.combinedScore})` : ""}`).join("; "),
      r.gaps.map((g) => `${g.skill} [${g.kind}]`).join("; "),
    ]
      .map(csvCell)
      .join(","),
  );
  const blob = new Blob([[head.map(csvCell).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ranking-${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "job"}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const JobReadCard: React.FC<{ job: RankResponse["job"] }> = ({ job }) => (
  <div className={card}>
    <h3 className="text-sm font-black text-slate-900 mb-3">How the job was read</h3>
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <span className="text-sm font-bold text-slate-800">{job.title}</span>
      {job.company && <span className="text-xs text-slate-500">at {job.company}</span>}
      <ParseBadge method={job.parseMethod} />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <p className="text-[11px] font-bold text-slate-500 mb-1">Required skills</p>
        <SkillChips names={job.required} tone="required" empty="None found" />
      </div>
      <div>
        <p className="text-[11px] font-bold text-slate-500 mb-1">Preferred skills</p>
        <SkillChips names={job.preferred} tone="preferred" empty="None found" />
      </div>
    </div>
    <p className="text-xs text-slate-600 mt-3">
      Minimum CGPA: <b>{job.minCgpa ?? "none"}</b>. Eligible branches: <b>{job.eligibleBranches.length ? job.eligibleBranches.join(", ") : "any"}</b>. Batches: <b>{job.graduationYears.length ? job.graduationYears.join(", ") : "any"}</b>.
    </p>
  </div>
);

const RankTable: React.FC<{ rows: RankRow[] }> = ({ rows }) => {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl">
      <table className="min-w-full divide-y divide-slate-100">
        <thead className="bg-slate-50">
          <tr>
            <th className={th}>#</th>
            <th className={th}>Student</th>
            <th className={th}>Fit</th>
            <th className={th}>Eligible</th>
            <th className={th}>Required</th>
            <th className={th}>Matched</th>
            <th className={th}>Gaps</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            const expanded = open === r.studentProfileId;
            return (
              <React.Fragment key={r.studentProfileId}>
                <tr onClick={() => setOpen(expanded ? null : r.studentProfileId)} className="cursor-pointer hover:bg-slate-50">
                  <td className={`${td} font-black text-slate-900`}>{r.rank}</td>
                  <td className={td}>
                    <button type="button" aria-expanded={expanded} className="text-left font-bold text-slate-900 hover:text-emerald-700">
                      {r.name}
                    </button>
                    <p className="text-[11px] text-slate-500">
                      {[r.branch, r.cgpa != null ? `CGPA ${r.cgpa}` : null, r.graduationYear ? `Batch ${r.graduationYear}` : null].filter(Boolean).join(" / ")}
                    </p>
                    <p className="text-[11px] text-slate-400">{r.institution ?? "Institution not set"}</p>
                  </td>
                  <td className={td}>
                    <div className="space-y-1">
                      <FitBadge score={r.fitScore} band={r.band} />
                      <FitBar score={r.fitScore} />
                    </div>
                  </td>
                  <td className={td}>
                    {r.eligible ? (
                      <span className="text-emerald-600 font-black" title="Eligible" aria-label="Eligible">
                        &#10003;
                      </span>
                    ) : (
                      <div className="space-y-1">
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-bold">Not eligible</span>
                        {r.eligibilityFlags.map((f) => (
                          <p key={f} className="text-[11px] text-rose-700">
                            {f}
                          </p>
                        ))}
                      </div>
                    )}
                    {r.eligibilityUnknown.length > 0 && <p className="text-[11px] text-slate-400 mt-1">Could not check: {r.eligibilityUnknown.join(", ")}</p>}
                  </td>
                  <td className={`${td} whitespace-nowrap font-bold`}>{r.requiredTotal ? `${r.requiredDemonstrated}/${r.requiredTotal} required` : "-"}</td>
                  <td className={td}>
                    <span className="inline-flex flex-wrap gap-1 max-w-xs">
                      {r.matched.length === 0 && <span className="text-[11px] text-slate-400">None backed by evidence yet</span>}
                      {r.matched.map((m) => (
                        <SkillChip key={m.skill} name={m.combinedScore != null ? `${m.skill} ${m.combinedScore}` : m.skill} tone="matched" title={`${m.requirement === "REQUIRED" ? "Required" : "Preferred"}, evidence-backed`} />
                      ))}
                    </span>
                  </td>
                  <td className={td}>
                    <span className="inline-flex flex-wrap gap-1 max-w-xs">
                      {r.gaps.length === 0 && <span className="text-[11px] text-slate-400">No gaps</span>}
                      {r.gaps.map((g) => (
                        <GapChip key={g.skill} skill={g.skill} requirement={g.requirement} kind={g.kind} detail={g.detail} />
                      ))}
                    </span>
                  </td>
                </tr>
                {expanded && (
                  <tr className="bg-slate-50">
                    <td />
                    <td colSpan={6} className="px-3 py-3 text-xs text-slate-700">
                      <p className="font-bold text-slate-600 mb-1">Why this ranking</p>
                      <p>{r.explanation}</p>
                      <p className="text-[11px] text-slate-500 mt-2">
                        {r.verifiedSkills} verified skill{r.verifiedSkills === 1 ? "" : "s"}
                        {r.flaggedSkills > 0 ? `, ${r.flaggedSkills} not backed by evidence yet` : ""}. {r.email}
                      </p>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export const PlacementRankPage: React.FC = () => {
  const { accessToken } = useAuth();
  const [params] = useSearchParams();
  const initialJobId = params.get("jobId") ?? "";

  const [mode, setMode] = useState<Mode>(initialJobId ? "existing" : "paste");
  const [jd, setJd] = useState("");
  const [jobId, setJobId] = useState(initialJobId);
  const [institutionId, setInstitutionId] = useState("");
  const [branch, setBranch] = useState("");
  const [year, setYear] = useState("");
  const [minCgpa, setMinCgpa] = useState("");
  const [includeIneligible, setIncludeIneligible] = useState(true);
  const [limit, setLimit] = useState("100");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noSkills, setNoSkills] = useState(false);
  const [result, setResult] = useState<RankResponse | null>(null);

  const { data: jobsData, error: jobsError } = useQuery(fetchAllJobs);
  const jobs = jobsData ?? [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    const filter: RankFilter = {
      ...(institutionId ? { institutionId } : {}),
      ...(branch.trim() ? { branch: branch.trim() } : {}),
      ...(year ? { graduationYear: Number(year) } : {}),
      ...(minCgpa ? { minCgpa: Number(minCgpa) } : {}),
    };
    setBusy(true);
    setError(null);
    setNoSkills(false);
    try {
      setResult(await rankBatch(accessToken, { ...(mode === "existing" ? { jobId } : { jobDescription: jd }), filter, limit: Number(limit) || 100, includeIneligible }));
    } catch (err) {
      setResult(null);
      if (err instanceof ApiRequestError && err.code === "NO_SKILLS_FOUND") setNoSkills(true);
      else setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const ready = mode === "existing" ? !!jobId : jd.trim().length >= 20;

  return (
    <div className="space-y-6">
      <PageHeader title="Batch ranking" subtitle="Ranked by evidence-backed fit: skills only count when backed by assessment scores or GitHub evidence." />

      <form onSubmit={submit} className={`${card} space-y-4`}>
        <div className="inline-flex rounded-xl bg-slate-100 p-1" role="tablist">
          {(
            [
              ["paste", "Paste a job description"],
              ["existing", "Pick an existing opening"],
            ] as [Mode, string][]
          ).map(([m, text]) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${mode === m ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
              {text}
            </button>
          ))}
        </div>

        {mode === "paste" ? (
          <Field label="Job description" htmlFor="rk-jd" hint="Pasted text is read on the spot and is not saved as an opening.">
            <textarea id="rk-jd" rows={7} value={jd} onChange={(e) => setJd(e.target.value)} className={input} placeholder="Paste the full job description, including the skills required" />
          </Field>
        ) : (
          <Field label="Opening" htmlFor="rk-job">
            <select id="rk-job" value={jobId} onChange={(e) => setJobId(e.target.value)} className={input}>
              <option value="">Select an opening</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} - {j.company?.name ?? "Unknown company"} ({j.status.toLowerCase()})
                </option>
              ))}
              {jobId && !jobs.some((j) => j.id === jobId) && <option value={jobId}>Selected opening</option>}
            </select>
            <ErrorBox message={jobsError} />
          </Field>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Field label="Institution" htmlFor="rk-inst">
            <select id="rk-inst" value={institutionId} onChange={(e) => setInstitutionId(e.target.value)} className={input}>
              <option value="">All institutions</option>
              {FIXED_INSTITUTIONS.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Branch" htmlFor="rk-branch">
            <input id="rk-branch" value={branch} onChange={(e) => setBranch(e.target.value)} className={input} placeholder="Any" />
          </Field>
          <Field label="Graduation year" htmlFor="rk-year">
            <input id="rk-year" type="number" min={2020} max={2040} value={year} onChange={(e) => setYear(e.target.value)} className={input} placeholder="Any" />
          </Field>
          <Field label="Min CGPA" htmlFor="rk-cgpa">
            <input id="rk-cgpa" type="number" min={0} max={10} step={0.1} value={minCgpa} onChange={(e) => setMinCgpa(e.target.value)} className={input} placeholder="Any" />
          </Field>
          <Field label="Limit" htmlFor="rk-limit">
            <input id="rk-limit" type="number" min={1} max={500} value={limit} onChange={(e) => setLimit(e.target.value)} className={input} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <input type="checkbox" checked={includeIneligible} onChange={(e) => setIncludeIneligible(e.target.checked)} className="accent-emerald-600" />
          Include ineligible students (shown with the reasons)
        </label>
        <button type="submit" disabled={busy || !ready} className={btnPrimary}>
          {busy ? "Ranking..." : "Rank batch"}
        </button>
      </form>

      <ErrorBox message={error} />
      {noSkills && (
        <div role="alert" className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold">
          No known skills were found in that description, so students cannot be ranked yet. Check that it names the skills required (for example React, Node.js, SQL), or pick an existing opening instead.
        </div>
      )}

      {result && (
        <>
          <JobReadCard job={result.job} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-slate-800">
              Ranked {result.returned} of {result.totalStudents} students
            </p>
            {result.rows.length > 0 && (
              <button type="button" onClick={() => downloadCsv(result.rows, result.job.title)} className={btnGhost}>
                Export CSV
              </button>
            )}
          </div>
          {result.rows.length === 0 ? <Empty title="No students match these filters" hint="Loosen the filters or include ineligible students." /> : <RankTable rows={result.rows} />}
          <p className="text-[11px] text-slate-500">
            Dashed amber skills are claimed on a profile but not backed by evidence yet. Red skills are required and missing.
          </p>
        </>
      )}
    </div>
  );
};
