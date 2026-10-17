import React, { useEffect, useState } from "react";
import {
  fetchSkillScoresApi,
  runSkillVerificationApi,
  type CombinedSkillResult,
  type SkillScoresData,
  type SkillVerificationStatus,
} from "../api/assessment";

// ---------------------------------------------------------------------------
// Skill Verification panel: every skill listed on the resume, with the evidence behind it.
// Combines the assessment score with public GitHub evidence (80% / 20%).
// ---------------------------------------------------------------------------

const STATUS_META: Record<SkillVerificationStatus, { label: string; badge: string }> = {
  verified: { label: "Verified", badge: "bg-emerald-100 text-emerald-800" },
  partially_verified: { label: "Partially verified", badge: "bg-blue-100 text-blue-800" },
  needs_review: { label: "Needs review", badge: "bg-amber-100 text-amber-800" },
  unsupported: { label: "Unsupported", badge: "bg-rose-100 text-rose-800" },
  unverified: { label: "Unverified", badge: "bg-slate-200 text-slate-700" },
};

const EVIDENCE_LABEL: Record<string, string> = {
  dependency: "Dependency",
  source_usage: "Source code",
  configuration: "Config / files",
  contribution: "Contribution",
};

const repoName = (url: string) => url.replace(/^https?:\/\/github\.com\//, "");

const Score: React.FC<{ label: string; value: number | null }> = ({ label, value }) => (
  <div className="text-center min-w-[64px]">
    <div className={`text-lg font-black tracking-tight ${value === null ? "text-slate-300" : "text-slate-900"}`}>
      {value === null ? "—" : value}
    </div>
    <div className="text-[10px] font-bold uppercase text-slate-500">{label}</div>
  </div>
);

const SkillRow: React.FC<{ skill: CombinedSkillResult }> = ({ skill: s }) => {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[s.verification.status];
  const hasDetail =
    s.evidence.length > 0 ||
    s.conflicts.length > 0 ||
    s.assessmentQuestionIds.length > 0 ||
    s.resumeReferences.length > 0;

  return (
    <div
      className={`p-4 rounded-xl border ${
        s.verification.flagged ? "border-amber-200 bg-amber-50/40" : "border-slate-100 bg-slate-50/50"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold text-slate-900 truncate">{s.skill}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.badge}`}>{meta.label}</span>
          {s.verification.flagged && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">Flagged</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Score label="Assessment" value={s.assessmentScore} />
          <Score label="GitHub" value={s.githubEvidenceScore} />
          <Score label="Combined" value={s.combinedScore} />
        </div>
      </div>

      <p className="text-xs text-slate-600 leading-relaxed mt-2">{s.verification.reason}</p>
      <p className="text-[11px] text-slate-500 leading-relaxed mt-1">{s.evidenceSummary}</p>

      {hasDetail && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-2 text-[11px] font-bold text-blue-700 hover:text-blue-900"
        >
          {open ? "Hide proof" : "Show proof"}
        </button>
      )}

      {open && (
        <div className="mt-2 space-y-2 text-[11px] text-slate-600">
          {s.assessmentPoints && (
            <div>
              <strong>Assessment:</strong> {s.assessmentPoints.earned} / {s.assessmentPoints.possible} pts
              {s.assessmentQuestionIds.length > 0 && <> (questions {s.assessmentQuestionIds.join(", ")})</>}
            </div>
          )}
          {s.resumeReferences.length > 0 && (
            <div>
              <strong>Claimed in resume:</strong> {s.resumeReferences.join("; ")}
            </div>
          )}
          {s.evidence.length > 0 && (
            <ul className="space-y-1">
              {s.evidence.map((e, i) => (
                <li key={i}>
                  <span className="font-semibold">{EVIDENCE_LABEL[e.type] ?? e.type}</span> in{" "}
                  <a
                    href={e.evidenceUrl ?? e.repositoryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-700 underline"
                  >
                    {repoName(e.repositoryUrl)}
                  </a>
                  {e.commitSha && <span className="text-slate-400 font-mono"> @{e.commitSha.slice(0, 7)}</span>}
                </li>
              ))}
            </ul>
          )}
          {s.conflicts.map((c, i) => (
            <div key={i} className="text-amber-800">
              ⚠ {c}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const SkillVerificationPanel: React.FC<{ token: string | null; sessionId: string }> = ({
  token,
  sessionId,
}) => {
  const [data, setData] = useState<SkillScoresData | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchSkillScoresApi(token, sessionId)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load skill verification");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, sessionId]);

  const verify = async () => {
    if (!token) return;
    setVerifying(true);
    setError(null);
    try {
      setData(await runSkillVerificationApi(token, sessionId, username));
    } catch (err) {
      setError(err instanceof Error ? err.message : "GitHub verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const skills = (data?.skills ?? []).filter((s) => !flaggedOnly || s.verification.flagged);
  const gh = data?.github;
  const checked = gh?.state === "completed" || gh?.state === "incomplete";

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
      <h3 className="text-sm font-bold text-slate-900">Skill Verification</h3>
      <p className="text-xs text-slate-500 mt-1 max-w-xl">
        Every skill on your resume, checked against your assessment answers and your public GitHub work. Combined
        score ={" "}
        {data
          ? `${Math.round(data.weights.assessment * 100)}% assessment + ${Math.round(data.weights.github * 100)}% GitHub`
          : "assessment + GitHub"}
        . GitHub is supporting evidence only; a missing GitHub score never lowers your score.
      </p>

      {/* GitHub verification controls */}
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="GitHub username (optional if on resume or profile)"
          className="flex-1 min-w-[220px] text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={verify}
          disabled={verifying || loading || !token}
          className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {verifying ? "Checking GitHub…" : checked ? "Re-run GitHub check" : "Verify with GitHub"}
        </button>
      </div>

      {error && (
        <div className="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{error}</div>
      )}

      {gh && (
        <div
          className={`mt-3 text-xs rounded-lg p-3 border ${
            gh.state === "completed"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : gh.state === "incomplete"
              ? "bg-amber-50 border-amber-200 text-amber-800"
              : gh.state === "failed"
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : "bg-slate-50 border-slate-200 text-slate-600"
          }`}
        >
          {gh.state === "not_run" && "GitHub has not been checked yet. Scores below use your assessment only."}
          {gh.state === "completed" &&
            `GitHub checked for @${gh.username} (${gh.repositoriesInspected ?? 0} repositories inspected).`}
          {gh.state === "incomplete" &&
            `GitHub check for @${gh.username} was incomplete (rate limit or budget); missing evidence is not counted against you.`}
          {gh.state === "failed" &&
            `GitHub check failed: ${gh.error?.message ?? "unknown error"}. Scores below use your assessment only.`}
          {gh.state !== "failed" && gh.error && ` Latest re-run failed: ${gh.error.message}`}
        </div>
      )}

      {data?.persistence && (
        <div
          className={`mt-3 text-xs rounded-lg p-3 border ${
            "error" in data.persistence || data.persistence.failed > 0
              ? "bg-amber-50 border-amber-200 text-amber-800"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          {"error" in data.persistence
            ? data.persistence.error
            : `Saved to your skill profile: ${data.persistence.skills} skills, ${
                data.persistence.evidenceCreated + data.persistence.evidenceUpdated
              } proof items${data.persistence.failed > 0 ? ` (${data.persistence.failed} skills could not be saved)` : ""}.`}
        </div>
      )}

      {loading && <p className="text-xs text-slate-500 mt-4">Loading skill verification…</p>}

      {data && (
        <>
          {/* Summary */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {(Object.keys(STATUS_META) as SkillVerificationStatus[]).map((k) => (
              <span key={k} className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS_META[k].badge}`}>
                {data.verification[k]} {STATUS_META[k].label}
              </span>
            ))}
            <label className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 cursor-pointer">
              <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
              Flagged only ({data.verification.flagged})
            </label>
          </div>

          <div className="space-y-3 mt-4">
            {skills.map((s) => (
              <SkillRow key={s.skill} skill={s} />
            ))}
            {skills.length === 0 && <p className="text-xs text-slate-500">No skills to show.</p>}
          </div>

          <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
            Verified means assessment ≥ {data.thresholds.pass}% plus GitHub evidence. Unsupported and Unverified skills
            are not backed by evidence yet; that is not the same as being proven false.
          </p>
        </>
      )}
    </div>
  );
};
