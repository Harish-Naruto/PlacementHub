import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  createJob,
  getRecruiterProfile,
  searchSkills,
  type JobPayload,
  type Skill,
} from "../../api/recruiter";

interface PostJobProps {
  onSuccess: (jobId: string) => void;
  onNavigateProfile?: () => void;
}

type Step = 1 | 2 | 3 | 4;

const WORK_MODES = ["ONSITE", "HYBRID", "REMOTE"] as const;
const EMP_TYPES = ["FULL_TIME", "INTERNSHIP", "CONTRACT", "PART_TIME"] as const;
const PROFICIENCY_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const;
type RequirementType = "REQUIRED" | "PREFERRED";

interface SelectedSkill {
  skill: Skill;
  requirementType: RequirementType;
  weight: number;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export const RecruiterPostJob: React.FC<PostJobProps> = ({ onSuccess, onNavigateProfile }) => {
  const { accessToken } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    getRecruiterProfile(accessToken)
      .then((p) => { if (!p?.company) setProfileMissing(true); })
      .catch(() => {});
  }, [accessToken]);

  // ── Step 1 – basics ─────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [workMode, setWorkMode] = useState<typeof WORK_MODES[number]>("ONSITE");
  const [empType, setEmpType] = useState<typeof EMP_TYPES[number]>("FULL_TIME");
  const [deadline, setDeadline] = useState("");
  const [externalUrl, setExternalUrl] = useState("");

  // ── Step 2 – eligibility ─────────────────────────────────────────────────────
  const [minCgpa, setMinCgpa] = useState("");
  const [branches, setBranches] = useState("");
  const [gradYears, setGradYears] = useState("");

  // ── Step 3 – skill requirements ──────────────────────────────────────────────
  const [skillQuery, setSkillQuery] = useState("");
  const [skillResults, setSkillResults] = useState<Skill[]>([]);
  const [skillSearching, setSkillSearching] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState<SelectedSkill[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(skillQuery, 300);

  const searchRef = useRef(false);
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSkillResults([]); setShowDropdown(false); return; }
    if (searchRef.current) return;
    searchRef.current = true;
    setSkillSearching(true);
    try {
      const res = await searchSkills(q.trim(), undefined, 15);
      setSkillResults(res);
      setShowDropdown(res.length > 0);
    } catch {
      setSkillResults([]);
    } finally {
      setSkillSearching(false);
      searchRef.current = false;
    }
  }, []);

  useEffect(() => { doSearch(debouncedQuery); }, [debouncedQuery, doSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addSkill = (skill: Skill, type: RequirementType = "REQUIRED") => {
    if (selectedSkills.some((s) => s.skill.id === skill.id)) {
      setShowDropdown(false);
      setSkillQuery("");
      return;
    }
    setSelectedSkills((prev) => [...prev, { skill, requirementType: type, weight: 1.0 }]);
    setSkillQuery("");
    setShowDropdown(false);
  };

  const removeSkill = (skillId: string) => {
    setSelectedSkills((prev) => prev.filter((s) => s.skill.id !== skillId));
  };

  const toggleRequirementType = (skillId: string) => {
    setSelectedSkills((prev) =>
      prev.map((s) =>
        s.skill.id === skillId
          ? { ...s, requirementType: s.requirementType === "REQUIRED" ? "PREFERRED" : "REQUIRED" }
          : s
      )
    );
  };

  const setWeight = (skillId: string, weight: number) => {
    setSelectedSkills((prev) =>
      prev.map((s) => (s.skill.id === skillId ? { ...s, weight } : s))
    );
  };

  // ── Step 4 – review + publish ────────────────────────────────────────────────
  const [publishNow, setPublishNow] = useState(false);

  const handleSubmit = async () => {
    if (!accessToken) return;
    setSaving(true);
    setError(null);

    const branchList = branches.split(",").map((b) => b.trim()).filter(Boolean);
    const yearList = gradYears.split(",").map((y) => parseInt(y.trim())).filter((y) => !isNaN(y));
    const deadlineIso = deadline ? new Date(deadline).toISOString() : undefined;

    const payload: JobPayload = {
      title: title.trim(),
      description: description.trim(),
      location: location.trim() || undefined,
      workMode,
      employmentType: empType,
      minimumCgpa: minCgpa ? parseFloat(minCgpa) : undefined,
      applicationDeadline: deadlineIso,
      externalUrl: externalUrl.trim() || undefined,
      eligibleBranches: branchList.length ? branchList : undefined,
      eligibleGraduationYears: yearList.length ? yearList : undefined,
      skillRequirements: selectedSkills.map((s) => ({
        skillId: s.skill.id,
        requirementType: s.requirementType,
        weight: s.weight,
      })),
      status: publishNow ? "PUBLISHED" : "DRAFT",
    };

    try {
      const job = await createJob(accessToken, payload);
      onSuccess(job.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job");
      setSaving(false);
    }
  };

  const inputCls =
    "w-full bg-white/[0.05] border border-white/10 text-white placeholder-slate-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition";
  const labelCls = "block text-xs font-semibold text-slate-400 mb-1.5";

  const StepDot = ({ n, label }: { n: Step; label: string }) => (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300 ${
          step === n
            ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/30"
            : step > n
            ? "bg-emerald-600/30 border-emerald-500/50 text-emerald-300"
            : "bg-white/[0.04] border-white/10 text-slate-500"
        }`}
      >
        {step > n ? "✓" : n}
      </div>
      <span className={`text-[9px] font-semibold uppercase tracking-wider ${step === n ? "text-indigo-300" : step > n ? "text-emerald-500" : "text-slate-600"}`}>{label}</span>
    </div>
  );

  const requiredCount = selectedSkills.filter((s) => s.requirementType === "REQUIRED").length;
  const preferredCount = selectedSkills.filter((s) => s.requirementType === "PREFERRED").length;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white">Post a New Job</h1>
        <p className="text-sm text-slate-400 mt-1">Fill in the details to attract the best candidates.</p>
      </div>

      {/* Profile missing warning */}
      {profileMissing && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
          <div>
            <p className="text-sm font-bold text-amber-300">Company Profile Required</p>
            <p className="text-xs text-amber-300/80 mt-0.5">You must set up your company profile before submitting job postings.</p>
          </div>
          {onNavigateProfile && (
            <button type="button" onClick={onNavigateProfile} className="px-4 py-2 text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-xl transition cursor-pointer self-start sm:self-auto shrink-0">
              Set Up Profile Now →
            </button>
          )}
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-1">
        <StepDot n={1} label="Basics" />
        <div className={`flex-1 h-0.5 rounded-full ${step > 1 ? "bg-emerald-500/40" : "bg-white/[0.07]"}`} />
        <StepDot n={2} label="Eligibility" />
        <div className={`flex-1 h-0.5 rounded-full ${step > 2 ? "bg-emerald-500/40" : "bg-white/[0.07]"}`} />
        <StepDot n={3} label="Skills" />
        <div className={`flex-1 h-0.5 rounded-full ${step > 3 ? "bg-emerald-500/40" : "bg-white/[0.07]"}`} />
        <StepDot n={4} label="Review" />
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">{error}</div>
      )}

      {/* ── Step 1: Basics ── */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <label className={labelCls}>Job Title <span className="text-rose-400">*</span></label>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Software Engineer" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Description <span className="text-rose-400">*</span></label>
            <textarea required rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the role, responsibilities, and what you're looking for..." className={`${inputCls} resize-none`} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Location</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Bangalore, IN" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Application Deadline</label>
              <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Work Mode</label>
              <div className="flex flex-col gap-2">
                {WORK_MODES.map((m) => (
                  <button key={m} type="button" onClick={() => setWorkMode(m)}
                    className={`py-2.5 px-4 rounded-xl text-xs font-semibold border transition-all ${workMode === m ? "bg-indigo-600/30 border-indigo-500/50 text-indigo-300" : "bg-white/[0.03] border-white/[0.07] text-slate-500 hover:text-white hover:bg-white/[0.06]"}`}>
                    {m === "ONSITE" ? "🏢 Onsite" : m === "HYBRID" ? "🔀 Hybrid" : "🌐 Remote"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Employment Type</label>
              <div className="flex flex-col gap-2">
                {EMP_TYPES.map((t) => (
                  <button key={t} type="button" onClick={() => setEmpType(t)}
                    className={`py-2.5 px-4 rounded-xl text-xs font-semibold border transition-all ${empType === t ? "bg-indigo-600/30 border-indigo-500/50 text-indigo-300" : "bg-white/[0.03] border-white/[0.07] text-slate-500 hover:text-white hover:bg-white/[0.06]"}`}>
                    {t === "FULL_TIME" ? "💼 Full-time" : t === "INTERNSHIP" ? "🎓 Internship" : t === "CONTRACT" ? "📄 Contract" : "⏰ Part-time"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls}>External URL (optional)</label>
            <input type="url" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://careers.company.com/job" className={inputCls} />
          </div>

          <button
            onClick={() => { if (!title.trim() || !description.trim()) { setError("Title and description are required."); return; } setError(null); setStep(2); }}
            className="w-full py-3.5 text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white rounded-xl shadow-lg shadow-indigo-500/25 transition"
          >
            Continue to Eligibility →
          </button>
        </div>
      )}

      {/* ── Step 2: Eligibility ── */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <label className={labelCls}>Minimum CGPA</label>
            <input type="number" step="0.01" min="0" max="10" value={minCgpa} onChange={(e) => setMinCgpa(e.target.value)} placeholder="e.g. 7.5" className={inputCls} />
            <p className="text-xs text-slate-600 mt-1">Leave empty if no minimum CGPA requirement.</p>
          </div>
          <div>
            <label className={labelCls}>Eligible Branches</label>
            <input value={branches} onChange={(e) => setBranches(e.target.value)} placeholder="e.g. Computer Science, Electronics, Mechanical" className={inputCls} />
            <p className="text-xs text-slate-600 mt-1">Comma-separated. Leave empty for all branches.</p>
          </div>
          <div>
            <label className={labelCls}>Eligible Graduation Years</label>
            <input value={gradYears} onChange={(e) => setGradYears(e.target.value)} placeholder="e.g. 2025, 2026, 2027" className={inputCls} />
            <p className="text-xs text-slate-600 mt-1">Comma-separated years. Leave empty for all years.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 py-3.5 text-sm font-semibold bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 text-slate-300 rounded-xl transition">← Back</button>
            <button onClick={() => { setError(null); setStep(3); }} className="flex-[2] py-3.5 text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white rounded-xl shadow-lg shadow-indigo-500/25 transition">
              Add Skill Requirements →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Skill Requirements ── */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Info banner */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-200/90 leading-relaxed">
            <span className="text-lg leading-none shrink-0">🎯</span>
            <div>
              <p className="font-semibold text-indigo-200 mb-0.5">Skill Requirement Matching</p>
              <p>Skills you add here will be used to automatically rank applicants based on their verified skill profiles (GitHub analysis, assessments, projects). <span className="text-indigo-300 font-medium">REQUIRED</span> skills carry more weight; <span className="text-amber-300 font-medium">PREFERRED</span> skills boost candidate scores.</p>
            </div>
          </div>

          {/* Search input */}
          <div>
            <label className={labelCls}>Search & Add Skills</label>
            <div className="relative" ref={dropdownRef}>
              <div className="relative">
                <input
                  value={skillQuery}
                  onChange={(e) => { setSkillQuery(e.target.value); if (e.target.value.trim()) setShowDropdown(true); }}
                  onFocus={() => { if (skillResults.length > 0) setShowDropdown(true); }}
                  placeholder="Search by skill name, e.g. React, Python, Docker…"
                  className={`${inputCls} pl-10`}
                />
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                  {skillSearching ? (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Dropdown results */}
              {showDropdown && skillResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#1a1a35] border border-white/10 rounded-xl shadow-2xl shadow-black/40 z-30 overflow-hidden max-h-56 overflow-y-auto">
                  {skillResults.map((skill) => {
                    const alreadyAdded = selectedSkills.some((s) => s.skill.id === skill.id);
                    return (
                      <div key={skill.id} className={`flex items-center justify-between px-4 py-2.5 gap-3 ${alreadyAdded ? "opacity-40 cursor-not-allowed" : "hover:bg-white/[0.06] cursor-pointer"} transition`}>
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
                            {skill.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{skill.name}</p>
                            {skill.category && <p className="text-[10px] text-slate-500">{skill.category}</p>}
                          </div>
                        </div>
                        {!alreadyAdded && (
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              type="button"
                              onMouseDown={(e) => { e.preventDefault(); addSkill(skill, "REQUIRED"); }}
                              className="px-2.5 py-1 text-[10px] font-bold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 rounded-lg transition"
                            >REQUIRED</button>
                            <button
                              type="button"
                              onMouseDown={(e) => { e.preventDefault(); addSkill(skill, "PREFERRED"); }}
                              className="px-2.5 py-1 text-[10px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg transition"
                            >PREFERRED</button>
                          </div>
                        )}
                        {alreadyAdded && (
                          <span className="text-[10px] text-slate-500 font-medium shrink-0">Added</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {showDropdown && skillResults.length === 0 && skillQuery.trim() && !skillSearching && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#1a1a35] border border-white/10 rounded-xl shadow-2xl shadow-black/40 z-30 px-4 py-5 text-center">
                  <p className="text-sm text-slate-500">No skills found for "<span className="text-white">{skillQuery}</span>"</p>
                  <p className="text-xs text-slate-600 mt-1">Ask your admin to add this skill to the catalogue.</p>
                </div>
              )}
            </div>
          </div>

          {/* Selected skills list */}
          {selectedSkills.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-300">
                  {selectedSkills.length} skill{selectedSkills.length !== 1 ? "s" : ""} added
                  {requiredCount > 0 && <span className="ml-1.5 text-indigo-400">· {requiredCount} required</span>}
                  {preferredCount > 0 && <span className="ml-1 text-amber-400">· {preferredCount} preferred</span>}
                </p>
              </div>

              {selectedSkills.map((s) => (
                <div key={s.skill.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${s.requirementType === "REQUIRED" ? "bg-indigo-500/[0.08] border-indigo-500/20" : "bg-amber-500/[0.06] border-amber-500/20"}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${s.requirementType === "REQUIRED" ? "bg-indigo-500/25 text-indigo-300" : "bg-amber-500/20 text-amber-300"}`}>
                    {s.skill.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{s.skill.name}</p>
                    {s.skill.category && <p className="text-[10px] text-slate-500">{s.skill.category}</p>}
                  </div>

                  {/* Requirement type toggle */}
                  <button
                    type="button"
                    onClick={() => toggleRequirementType(s.skill.id)}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all ${s.requirementType === "REQUIRED" ? "bg-indigo-600/30 text-indigo-300 border-indigo-500/40 hover:bg-amber-500/20 hover:text-amber-300 hover:border-amber-500/40" : "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-indigo-600/30 hover:text-indigo-300 hover:border-indigo-500/40"}`}
                    title="Click to toggle between REQUIRED and PREFERRED"
                  >
                    {s.requirementType}
                  </button>

                  {/* Weight selector */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-slate-500 font-medium">wt</span>
                    <select
                      value={s.weight}
                      onChange={(e) => setWeight(s.skill.id, parseFloat(e.target.value))}
                      className="bg-white/[0.05] border border-white/10 text-white text-xs rounded-lg px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
                      title="Matching weight (higher = more important for ranking)"
                    >
                      {[0.5, 1.0, 1.5, 2.0, 3.0].map((w) => (
                        <option key={w} value={w}>{w}×</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeSkill(s.skill.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                    title="Remove skill"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 gap-2">
              <span className="text-3xl">🔍</span>
              <p className="text-sm font-medium text-slate-400">No skills added yet</p>
              <p className="text-xs text-slate-600">Search and add skills above to enable candidate matching. This step is optional.</p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="flex-1 py-3.5 text-sm font-semibold bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 text-slate-300 rounded-xl transition">← Back</button>
            <button onClick={() => { setError(null); setStep(4); }} className="flex-[2] py-3.5 text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white rounded-xl shadow-lg shadow-indigo-500/25 transition">
              Review & Post →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Review ── */}
      {step === 4 && (
        <div className="space-y-5">
          <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/[0.07] space-y-4">
            <h3 className="text-base font-bold text-white">{title}</h3>

            <div className="flex flex-wrap gap-2">
              <span className="text-xs px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">{workMode}</span>
              <span className="text-xs px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/30">{empType.replace("_", " ")}</span>
              {location && <span className="text-xs px-2.5 py-1 rounded-lg bg-white/[0.06] text-slate-400 border border-white/[0.07]">📍 {location}</span>}
              {deadline && <span className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30">⏰ {new Date(deadline).toLocaleDateString()}</span>}
            </div>

            <p className="text-xs text-slate-400 leading-relaxed line-clamp-4">{description}</p>

            {(minCgpa || branches || gradYears) && (
              <div className="pt-3 border-t border-white/[0.07] space-y-1.5">
                <p className="text-xs font-semibold text-slate-300">Eligibility</p>
                {minCgpa && <p className="text-xs text-slate-500">Min. CGPA: <span className="text-white">{minCgpa}</span></p>}
                {branches && <p className="text-xs text-slate-500">Branches: <span className="text-white">{branches}</span></p>}
                {gradYears && <p className="text-xs text-slate-500">Grad. Years: <span className="text-white">{gradYears}</span></p>}
              </div>
            )}

            {/* Skill requirements summary */}
            {selectedSkills.length > 0 && (
              <div className="pt-3 border-t border-white/[0.07]">
                <p className="text-xs font-semibold text-slate-300 mb-2">
                  Skill Requirements <span className="text-slate-500 font-normal">({selectedSkills.length})</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedSkills.map((s) => (
                    <span
                      key={s.skill.id}
                      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border font-medium ${s.requirementType === "REQUIRED" ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" : "bg-amber-500/10 text-amber-300 border-amber-500/25"}`}
                    >
                      {s.skill.name}
                      <span className="text-[9px] opacity-60">{s.requirementType === "REQUIRED" ? "req" : "pref"}</span>
                    </span>
                  ))}
                </div>
                {selectedSkills.length > 0 && (
                  <p className="text-[10px] text-slate-600 mt-2">
                    🤖 Applicants will be automatically ranked by skill match score when they apply.
                  </p>
                )}
              </div>
            )}
          </div>

          <label className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.04] border border-white/[0.07] cursor-pointer hover:bg-white/[0.06] transition">
            <input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} className="w-4 h-4 rounded text-indigo-500 bg-white/10 border-white/20 focus:ring-indigo-500" />
            <div>
              <p className="text-sm font-semibold text-white">Publish immediately</p>
              <p className="text-xs text-slate-500">Job will be visible to candidates right away. Otherwise saved as draft.</p>
            </div>
          </label>

          <div className="flex gap-3">
            <button onClick={() => setStep(3)} className="flex-1 py-3.5 text-sm font-semibold bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 text-slate-300 rounded-xl transition">← Back</button>
            <button
              disabled={saving}
              onClick={handleSubmit}
              className="flex-[2] py-3.5 text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white rounded-xl shadow-lg shadow-indigo-500/25 transition disabled:opacity-60"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Posting...
                </span>
              ) : publishNow ? "Post & Publish" : "Save as Draft"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// suppress unused import warning for PROFICIENCY_LEVELS (reserved for future UI)
void PROFICIENCY_LEVELS;
