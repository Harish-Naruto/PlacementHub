import React from "react";
import type { ResumeSnapshot } from "../../api/recruiterPortal";
import type { ClaimSummary, ResumeBullet } from "../../api/types";

const TierChip: React.FC<{ tier: ResumeBullet["tier"] }> = ({ tier }) =>
  tier === "verified" ? (
    <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">verified</span>
  ) : (
    <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">self-reported</span>
  );

const Bullet: React.FC<{ bullet: ResumeBullet }> = ({ bullet }) => (
  <li className="flex items-start gap-2 text-xs text-slate-700">
    <TierChip tier={bullet.tier} />
    <span>{bullet.text}</span>
  </li>
);

const Heading: React.FC<{ children: React.ReactNode }> = ({ children }) => <h5 className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">{children}</h5>;

const CLAIM_LABELS: [keyof Omit<ClaimSummary, "total" | "flagged">, string][] = [
  ["supported", "Supported"],
  ["partially_supported", "Partly supported"],
  ["self_reported", "Self-reported"],
  ["needs_review", "Needs review"],
  ["unsupported", "Not backed by evidence yet"],
  ["unverified", "Not yet verified"],
];

/** The resume the student sent with this application, as it was at the time. */
export const ResumeSnapshotView: React.FC<{ snapshot: ResumeSnapshot }> = ({ snapshot }) => {
  const { resume, claimSummary } = snapshot;
  return (
    <div className="space-y-4">
      <p className="text-[11px] text-slate-400">Generated {new Date(snapshot.generatedAt).toLocaleDateString()}</p>

      {claimSummary && (
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <p className="text-xs font-bold text-slate-800">
            Claim check: {claimSummary.flagged} of {claimSummary.total} claims flagged
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {CLAIM_LABELS.filter(([k]) => claimSummary[k] > 0).map(([k, label]) => (
              <span key={k} className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[11px] font-semibold text-slate-700">
                {label}: {claimSummary[k]}
              </span>
            ))}
          </div>
        </div>
      )}

      {resume.summary && (
        <div>
          <Heading>Summary</Heading>
          <ul>
            <Bullet bullet={resume.summary} />
          </ul>
        </div>
      )}

      {resume.skills.length > 0 && (
        <div>
          <Heading>Skills</Heading>
          <div className="flex flex-wrap gap-1.5">
            {resume.skills.map((s) => (
              <span key={s.factId} className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800">
                {s.skill}
                {s.combinedScore != null && <span className="opacity-60"> {s.combinedScore}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {resume.projects.length > 0 && (
        <div>
          <Heading>Projects</Heading>
          <div className="space-y-3">
            {resume.projects.map((p) => (
              <div key={p.id}>
                <p className="text-xs font-bold text-slate-800">
                  {p.title}
                  {p.link && (
                    <a href={p.link} target="_blank" rel="noreferrer" className="ml-2 font-semibold text-purple-700 hover:underline">
                      link
                    </a>
                  )}
                </p>
                <ul className="mt-1 space-y-1">
                  {p.bullets.map((b) => (
                    <Bullet key={b.factIds.join("|") + b.text} bullet={b} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {resume.experience.length > 0 && (
        <div>
          <Heading>Experience</Heading>
          <div className="space-y-3">
            {resume.experience.map((e) => (
              <div key={e.organization + (e.title ?? "") + (e.dates ?? "")}>
                <p className="text-xs font-bold text-slate-800">
                  {e.title ? `${e.title}, ` : ""}
                  {e.organization}
                  {e.dates && <span className="font-medium text-slate-500"> ({e.dates})</span>}
                </p>
                <ul className="mt-1 space-y-1">
                  {e.bullets.map((b) => (
                    <Bullet key={b.factIds.join("|") + b.text} bullet={b} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {resume.education && (
        <div>
          <Heading>Education</Heading>
          <ul>
            <Bullet bullet={resume.education} />
          </ul>
        </div>
      )}

      {resume.blocked.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
          <Heading>Left out because not backed by evidence</Heading>
          <ul className="space-y-1.5">
            {resume.blocked.map((b) => (
              <li key={b.kind + b.claim} className="text-xs text-amber-900">
                <span className="font-bold">{b.claim}</span> <span className="opacity-80">- {b.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
