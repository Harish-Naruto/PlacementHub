import React, { useCallback, useState } from "react";
import { fetchPlacementStudents, type RankFilter } from "../../api/placement";
import { FIXED_INSTITUTIONS } from "../../api/student";
import { Empty, ErrorBox, Loading, PageHeader } from "../../components/common/Feedback";
import { Field } from "../../components/placement/shared";
import { card, input, td, th, useDebounced } from "../../components/placement/ui";
import { useQuery } from "../../components/placement/useQuery";

export const PlacementStudentsPage: React.FC = () => {
  const [institutionId, setInstitutionId] = useState("");
  const [branch, setBranch] = useState("");
  const [year, setYear] = useState("");
  const [minCgpa, setMinCgpa] = useState("");
  const dBranch = useDebounced(branch);
  const dYear = useDebounced(year);
  const dCgpa = useDebounced(minCgpa);

  const fetcher = useCallback(
    (t: string) => {
      const filter: RankFilter = {
        ...(institutionId ? { institutionId } : {}),
        ...(dBranch.trim() ? { branch: dBranch.trim() } : {}),
        ...(dYear ? { graduationYear: Number(dYear) } : {}),
        ...(dCgpa ? { minCgpa: Number(dCgpa) } : {}),
      };
      return fetchPlacementStudents(t, filter);
    },
    [institutionId, dBranch, dYear, dCgpa],
  );
  const { data, error, loading, reload: load } = useQuery(fetcher);
  const students = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Students" subtitle="Everyone in the batch, with how much of their skills is backed by evidence." />

      <div className={`${card} grid grid-cols-2 lg:grid-cols-4 gap-4`}>
        <Field label="Institution" htmlFor="st-inst">
          <select id="st-inst" value={institutionId} onChange={(e) => setInstitutionId(e.target.value)} className={input}>
            <option value="">All institutions</option>
            {FIXED_INSTITUTIONS.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Branch" htmlFor="st-branch">
          <input id="st-branch" value={branch} onChange={(e) => setBranch(e.target.value)} className={input} placeholder="Any" />
        </Field>
        <Field label="Graduation year" htmlFor="st-year">
          <input id="st-year" type="number" min={2020} max={2040} value={year} onChange={(e) => setYear(e.target.value)} className={input} placeholder="Any" />
        </Field>
        <Field label="Min CGPA" htmlFor="st-cgpa">
          <input id="st-cgpa" type="number" min={0} max={10} step={0.1} value={minCgpa} onChange={(e) => setMinCgpa(e.target.value)} className={input} placeholder="Any" />
        </Field>
      </div>

      <ErrorBox message={error} onRetry={load} />
      {loading && <Loading />}
      {!loading && !error && students.length === 0 && <Empty title="No students match these filters" hint="Loosen the filters to see more." />}

      {students.length > 0 && (
        <>
          <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className={th}>Student</th>
                  <th className={th}>Institution</th>
                  <th className={th}>Branch</th>
                  <th className={th}>CGPA</th>
                  <th className={th}>Batch</th>
                  <th className={th}>Skills</th>
                  <th className={th}>Verified</th>
                  <th className={th}>Not backed yet</th>
                  <th className={th}>Applications</th>
                  <th className={th}>Interviewing</th>
                  <th className={th}>Offers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((s) => (
                  <tr key={s.studentProfileId} className="hover:bg-slate-50">
                    <td className={td}>
                      <p className="font-bold text-slate-900">{s.name}</p>
                      <p className="text-[11px] text-slate-400">{s.email}</p>
                    </td>
                    <td className={td}>{s.institution ?? "-"}</td>
                    <td className={td}>{s.branch ?? "-"}</td>
                    <td className={td}>{s.cgpa ?? "-"}</td>
                    <td className={td}>{s.graduationYear ?? "-"}</td>
                    <td className={td}>{s.skills}</td>
                    <td className={td}>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">{s.verifiedSkills}</span>
                    </td>
                    <td className={td}>
                      {s.flaggedSkills > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-[11px] font-bold" title="Claimed on a resume, not backed by evidence yet">
                          {s.flaggedSkills}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className={td}>{s.applications}</td>
                    <td className={td}>{s.interviewing}</td>
                    <td className={td}>{s.offers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-500">Verified = backed by assessment or GitHub evidence. Flagged skills are claimed but not backed by evidence yet.</p>
        </>
      )}
    </div>
  );
};
