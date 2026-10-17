import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  createRecruiterJob,
  type WorkMode,
  type EmploymentType,
  type JobStatus,
  type JobRequirementType,
} from "../../api/recruiter";

const COMMON_BRANCHES = [
  "Computer Engineering",
  "Information Technology",
  "Artificial Intelligence & Data Science",
  "Computer Science & Business Systems",
  "Electronics & Telecommunication",
  "Mechanical Engineering",
  "Electrical Engineering",
  "Civil Engineering",
];

const GRADUATION_YEARS = [2024, 2025, 2026, 2027, 2028];

export const PostJobPage: React.FC = () => {
  const { accessToken } = useAuth();
  const navigate = useNavigate();

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [workMode, setWorkMode] = useState<WorkMode>("ONSITE");
  const [employmentType, setEmploymentType] = useState<EmploymentType>("FULL_TIME");
  const [minimumCgpa, setMinimumCgpa] = useState<string>("");
  const [applicationDeadline, setApplicationDeadline] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [selectedBranches, setSelectedBranches] = useState<string[]>([
    "Computer Engineering",
    "Information Technology",
  ]);
  const [selectedYears, setSelectedYears] = useState<number[]>([2025, 2026]);

  // Skills
  const [skills, setSkills] = useState<
    Array<{ skillName: string; requirementType: JobRequirementType; weight: number }>
  >([
    { skillName: "JavaScript", requirementType: "REQUIRED", weight: 1.0 },
    { skillName: "React", requirementType: "REQUIRED", weight: 1.0 },
  ]);
  const [newSkillInput, setNewSkillInput] = useState("");
  const [newSkillType, setNewSkillType] = useState<JobRequirementType>("REQUIRED");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleBranch = (b: string) => {
    setSelectedBranches((prev) =>
      prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b],
    );
  };

  const toggleYear = (y: number) => {
    setSelectedYears((prev) =>
      prev.includes(y) ? prev.filter((x) => x !== y) : [...prev, y],
    );
  };

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newSkillInput.trim();
    if (!clean) return;
    if (skills.some((s) => s.skillName.toLowerCase() === clean.toLowerCase())) {
      setNewSkillInput("");
      return;
    }
    setSkills((prev) => [
      ...prev,
      { skillName: clean, requirementType: newSkillType, weight: 1.0 },
    ]);
    setNewSkillInput("");
  };

  const handleRemoveSkill = (idx: number) => {
    setSkills((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (targetStatus: JobStatus) => {
    if (!accessToken) return;
    if (!title.trim() || !description.trim()) {
      setErrorMsg("Please provide both a Job Title and Description.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await createRecruiterJob(accessToken, {
        title: title.trim(),
        description: description.trim(),
        location: location.trim() || null,
        workMode,
        employmentType,
        minimumCgpa: minimumCgpa ? parseFloat(minimumCgpa) : null,
        applicationDeadline: applicationDeadline || null,
        externalUrl: externalUrl.trim() || null,
        status: targetStatus,
        eligibleBranches: selectedBranches,
        graduationYears: selectedYears,
        skillRequirements: skills,
      });

      navigate("/dashboard/recruiter/jobs");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create job posting.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/dashboard/recruiter/jobs"
              className="text-xs font-bold text-purple-600 hover:underline"
            >
              ← Manage Jobs
            </Link>
            <span className="text-xs text-slate-400">/</span>
            <span className="text-xs text-slate-500 font-semibold">New Job Opening</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Create Campus Job Posting
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Post an opening to reach student talent across registered partner campuses.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSubmit("DRAFT")}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition disabled:opacity-50"
          >
            Save Draft
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSubmit("PUBLISHED")}
            className="px-5 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-md shadow-purple-500/20 hover:bg-purple-700 transition disabled:opacity-50 flex items-center gap-1.5"
          >
            <span>{loading ? "Posting..." : "Publish Job Now"}</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="font-bold hover:underline">
            ✕
          </button>
        </div>
      )}

      {/* Form Grid */}
      <div className="space-y-6">
        {/* Card 1: Primary Details */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-xs">
              1
            </span>
            <span>Role & Location</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Job Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Associate Software Engineer, Frontend Intern"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 text-sm text-slate-900 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Work Mode
              </label>
              <select
                value={workMode}
                onChange={(e) => setWorkMode(e.target.value as WorkMode)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 text-sm text-slate-900 outline-hidden bg-white"
              >
                <option value="ONSITE">On-Site Campus / Office</option>
                <option value="HYBRID">Hybrid</option>
                <option value="REMOTE">Remote</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Employment Type
              </label>
              <select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 text-sm text-slate-900 outline-hidden bg-white"
              >
                <option value="FULL_TIME">Full Time</option>
                <option value="INTERNSHIP">Internship</option>
                <option value="CONTRACT">Contract</option>
                <option value="PART_TIME">Part Time</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Job Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Pune, Bangalore, Mumbai, Remote"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 text-sm text-slate-900 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Minimum CGPA Requirement (Optional)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="10"
                value={minimumCgpa}
                onChange={(e) => setMinimumCgpa(e.target.value)}
                placeholder="e.g. 7.50"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 text-sm text-slate-900 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Application Deadline
              </label>
              <input
                type="date"
                value={applicationDeadline}
                onChange={(e) => setApplicationDeadline(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 text-sm text-slate-900 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                External Application URL (Optional)
              </label>
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://company.careers/job-123"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 text-sm text-slate-900 outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Description */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-xs">
              2
            </span>
            <span>Job Description & Responsibilities</span>
          </h2>

          <div>
            <textarea
              rows={8}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Outline role overview, core responsibilities, day-to-day tasks, qualifications, and company perks..."
              className="w-full p-4 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 text-sm text-slate-900 outline-hidden leading-relaxed"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Be specific about technical expectations and campus placement criteria.
            </p>
          </div>
        </div>

        {/* Card 3: Eligibility Filters */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-xs">
              3
            </span>
            <span>Target Disciplines & Batches</span>
          </h2>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Eligible Branches / Specializations
            </label>
            <div className="flex flex-wrap gap-2">
              {COMMON_BRANCHES.map((branch) => {
                const isSelected = selectedBranches.includes(branch);
                return (
                  <button
                    key={branch}
                    type="button"
                    onClick={() => toggleBranch(branch)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? "bg-purple-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {branch} {isSelected ? "✓" : "+"}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Eligible Graduation Batches
            </label>
            <div className="flex flex-wrap gap-2">
              {GRADUATION_YEARS.map((year) => {
                const isSelected = selectedYears.includes(year);
                return (
                  <button
                    key={year}
                    type="button"
                    onClick={() => toggleYear(year)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? "bg-purple-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Batch of {year} {isSelected ? "✓" : "+"}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Card 4: Skill Requirements */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-xs">
              4
            </span>
            <span>Skill Requirements</span>
          </h2>

          {/* Add skill input */}
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <input
              type="text"
              value={newSkillInput}
              onChange={(e) => setNewSkillInput(e.target.value)}
              placeholder="Enter skill (e.g. Python, Docker, SQL, Next.js)"
              className="flex-1 w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 text-xs text-slate-900 outline-hidden"
            />
            <select
              value={newSkillType}
              onChange={(e) => setNewSkillType(e.target.value as JobRequirementType)}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
            >
              <option value="REQUIRED">Required</option>
              <option value="PREFERRED">Preferred</option>
            </select>
            <button
              type="button"
              onClick={handleAddSkill}
              className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
            >
              Add Skill
            </button>
          </div>

          {/* Skill List */}
          <div className="flex flex-wrap gap-2 pt-2">
            {skills.map((s, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
              >
                <span className="font-bold text-slate-800">{s.skillName}</span>
                <span
                  className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                    s.requirementType === "REQUIRED"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {s.requirementType}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveSkill(idx)}
                  className="text-slate-400 hover:text-rose-600 transition ml-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            to="/dashboard/recruiter/jobs"
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
          >
            Cancel
          </Link>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSubmit("DRAFT")}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition disabled:opacity-50"
          >
            Save as Draft
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSubmit("PUBLISHED")}
            className="px-6 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-md shadow-purple-500/20 hover:bg-purple-700 transition disabled:opacity-50"
          >
            {loading ? "Publishing..." : "Publish Job Opening"}
          </button>
        </div>
      </div>
    </div>
  );
};
