import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  fetchInstitutions,
  fetchStudentProfile,
  updateStudentProfile,
  uploadResumeApi,
  fetchStudentSkills,
  addStudentSkill,
  deleteStudentSkill,
  fetchStudentProjects,
  createStudentProject,
  deleteStudentProject,
  fetchJobs,
  applyToJob,
  fetchApplications,
  withdrawApplicationApi,
  Institution,
  StudentProfileData,
  StudentSkill,
  ProjectData,
  JobData,
  ApplicationData,
  FIXED_INSTITUTIONS,
} from "../api/student";

export const StudentModule: React.FC = () => {
  const { accessToken, user } = useAuth();
  const [activeTab, setActiveTab] = useState<"profile" | "resume" | "skills" | "projects" | "jobs" | "applications">("profile");

  // Profile state
  const [institutions, setInstitutions] = useState<Institution[]>(FIXED_INSTITUTIONS);
  const [profile, setProfile] = useState<StudentProfileData | null>(null);
  const [profileForm, setProfileForm] = useState({
    name: "",
    institutionId: "",
    branch: "",
    degree: "",
    graduationYear: 2026,
    cgpa: 8.5,
    githubUsername: "",
    linkedinUrl: "",
    bio: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Resume state
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeMsg, setResumeMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [uploadedResumeName, setUploadedResumeName] = useState<string | null>(null);

  // Skills state
  const [skills, setSkills] = useState<StudentSkill[]>([]);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillLevel, setNewSkillLevel] = useState("INTERMEDIATE");
  const [addingSkill, setAddingSkill] = useState(false);

  // Projects state
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectForm, setProjectForm] = useState({
    title: "",
    description: "",
    personalContribution: "",
    repositoryUrl: "",
    demoUrl: "",
    skillNames: "",
  });
  const [creatingProject, setCreatingProject] = useState(false);

  // Jobs state
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [applications, setApplications] = useState<ApplicationData[]>([]);
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [jobMsg, setJobMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load initial data
  useEffect(() => {
    if (!accessToken) return;

    fetchInstitutions().then(setInstitutions).catch(() => {});

    fetchStudentProfile(accessToken)
      .then((p) => {
        setProfile(p);
        setProfileForm({
          name: user?.name || "",
          institutionId: p.institutionId || "",
          branch: p.branch || "",
          degree: p.degree || "",
          graduationYear: p.graduationYear || 2026,
          cgpa: p.cgpa ? Number(p.cgpa) : 8.5,
          githubUsername: p.githubUsername || "",
          linkedinUrl: p.linkedinUrl || "",
          bio: p.bio || "",
        });
      })
      .catch(() => {});

    fetchStudentSkills(accessToken).then(setSkills).catch(() => {});
    fetchStudentProjects(accessToken).then(setProjects).catch(() => {});
    fetchJobs(accessToken).then(setJobs).catch(() => {});
    fetchApplications(accessToken).then(setApplications).catch(() => {});
  }, [accessToken, user]);

  // Profile save handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const updated = await updateStudentProfile(accessToken, {
        name: profileForm.name || undefined,
        institutionId: profileForm.institutionId || null,
        branch: profileForm.branch || null,
        degree: profileForm.degree || null,
        graduationYear: Number(profileForm.graduationYear) || null,
        cgpa: Number(profileForm.cgpa) || null,
        githubUsername: profileForm.githubUsername || null,
        linkedinUrl: profileForm.linkedinUrl || null,
        bio: profileForm.bio || null,
      });
      setProfile(updated);
      setProfileMsg({ type: "success", text: "Profile updated successfully!" });
    } catch (err: any) {
      setProfileMsg({ type: "error", text: err.message || "Failed to save profile" });
    } finally {
      setSavingProfile(false);
    }
  };

  // Resume upload handler
  const handleResumeUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !resumeFile) return;
    setUploadingResume(true);
    setResumeMsg(null);
    try {
      const res = await uploadResumeApi(accessToken, resumeFile);
      setResumeMsg({ type: "success", text: res.message || "Resume uploaded successfully!" });
      setUploadedResumeName(resumeFile.name);
      setResumeFile(null);
    } catch (err: any) {
      setResumeMsg({ type: "error", text: err.message || "Upload failed" });
    } finally {
      setUploadingResume(false);
    }
  };

  // Skill add handler
  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !newSkillName.trim()) return;
    setAddingSkill(true);
    try {
      const newSkill = await addStudentSkill(accessToken, newSkillName.trim(), newSkillLevel);
      setSkills((prev) => [...prev, newSkill]);
      setNewSkillName("");
    } catch (err: any) {
      alert(err.message || "Failed to add skill");
    } finally {
      setAddingSkill(false);
    }
  };

  const handleDeleteSkill = async (id: string) => {
    if (!accessToken) return;
    try {
      await deleteStudentSkill(accessToken, id);
      setSkills((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete skill");
    }
  };

  // Project create handler
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !projectForm.title.trim()) return;
    setCreatingProject(true);
    try {
      const skillsArray = projectForm.skillNames
        ? projectForm.skillNames.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      const project = await createStudentProject(accessToken, {
        title: projectForm.title.trim(),
        description: projectForm.description.trim(),
        personalContribution: projectForm.personalContribution.trim() || undefined,
        repositoryUrl: projectForm.repositoryUrl.trim() || undefined,
        demoUrl: projectForm.demoUrl.trim() || undefined,
        skillNames: skillsArray,
      });
      setProjects((prev) => [project, ...prev]);
      setShowProjectModal(false);
      setProjectForm({
        title: "",
        description: "",
        personalContribution: "",
        repositoryUrl: "",
        demoUrl: "",
        skillNames: "",
      });
    } catch (err: any) {
      alert(err.message || "Failed to create project");
    } finally {
      setCreatingProject(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!accessToken) return;
    try {
      await deleteStudentProject(accessToken, id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete project");
    }
  };

  // Job apply handler
  const handleApplyJob = async (jobId: string) => {
    if (!accessToken) return;
    setApplyingJobId(jobId);
    setJobMsg(null);
    try {
      const app = await applyToJob(accessToken, jobId);
      setApplications((prev) => [app, ...prev]);
      setJobMsg({ type: "success", text: "Successfully applied to job!" });
    } catch (err: any) {
      setJobMsg({ type: "error", text: err.message || "Failed to apply" });
    } finally {
      setApplyingJobId(null);
    }
  };

  const handleWithdrawApplication = async (appId: string) => {
    if (!accessToken) return;
    try {
      await withdrawApplicationApi(accessToken, appId);
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: "WITHDRAWN" } : a))
      );
    } catch (err: any) {
      alert(err.message || "Failed to withdraw");
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "EVALUATED":
      case "VERIFIED":
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">Verified</span>;
      case "REPOSITORY_OBSERVED":
      case "OBSERVED":
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200">Observed</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200">Unverified</span>;
    }
  };

  return (
    <div className="w-full max-w-4xl bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-slate-100 overflow-hidden">
      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-100 bg-slate-50/70 p-2 gap-1 overflow-x-auto">
        {[
          { id: "profile", label: "Profile" },
          { id: "resume", label: "Resume Upload" },
          { id: "skills", label: `Skills (${skills.length})` },
          { id: "projects", label: `Projects (${projects.length})` },
          { id: "jobs", label: `Jobs (${jobs.length})` },
          { id: "applications", label: `Applications (${applications.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? "bg-white text-blue-600 shadow-sm border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-6 sm:p-8">
        {/* ========================================================================= */}
        {/* TAB 1: PROFILE */}
        {/* ========================================================================= */}
        {activeTab === "profile" && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900">Personal & Academic Profile</h2>
              <p className="text-sm text-slate-500">Keep your academic details and profiles up to date for campus recruiters.</p>
            </div>

            {profileMsg && (
              <div
                className={`p-4 rounded-xl mb-6 text-sm font-medium ${
                  profileMsg.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {profileMsg.text}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Full Name</label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter full name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Institution</label>
                  <select
                    value={profileForm.institutionId}
                    onChange={(e) => setProfileForm({ ...profileForm, institutionId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Institution</option>
                    {institutions.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name} ({inst.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Degree</label>
                  <input
                    type="text"
                    value={profileForm.degree}
                    onChange={(e) => setProfileForm({ ...profileForm, degree: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. B.Tech Computer Engineering"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Branch</label>
                  <input
                    type="text"
                    value={profileForm.branch}
                    onChange={(e) => setProfileForm({ ...profileForm, branch: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Computer Science"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Graduation Year</label>
                  <input
                    type="number"
                    value={profileForm.graduationYear}
                    onChange={(e) => setProfileForm({ ...profileForm, graduationYear: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">CGPA (0 - 10)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={profileForm.cgpa}
                    onChange={(e) => setProfileForm({ ...profileForm, cgpa: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">GitHub Username</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-sm">github.com/</span>
                    <input
                      type="text"
                      value={profileForm.githubUsername}
                      onChange={(e) => setProfileForm({ ...profileForm, githubUsername: e.target.value })}
                      className="w-full pl-28 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="username"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">LinkedIn Profile URL</label>
                  <input
                    type="url"
                    value={profileForm.linkedinUrl}
                    onChange={(e) => setProfileForm({ ...profileForm, linkedinUrl: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Short Bio</label>
                <textarea
                  rows={3}
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Passionate full-stack developer with experience in React and Node.js..."
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-md shadow-blue-500/20 transition-all disabled:opacity-60"
                >
                  {savingProfile ? "Saving Profile..." : "Save Profile"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: RESUME UPLOAD */}
        {/* ========================================================================= */}
        {activeTab === "resume" && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900">Upload Resume</h2>
              <p className="text-sm text-slate-500">Upload your latest resume (PDF or DOCX format, max 10MB).</p>
            </div>

            {resumeMsg && (
              <div
                className={`p-4 rounded-xl mb-6 text-sm font-medium ${
                  resumeMsg.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                ✓ {resumeMsg.text}
              </div>
            )}

            {uploadedResumeName && (
              <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                    PDF
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{uploadedResumeName}</h4>
                    <p className="text-xs text-slate-500">Active resume on file</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">
                  Uploaded
                </span>
              </div>
            )}

            <form onSubmit={handleResumeUpload} className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 transition-colors rounded-2xl p-8 text-center bg-slate-50/50">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-700">Choose a file or drag and drop</p>
                <p className="text-xs text-slate-400 mt-1">PDF or DOCX up to 10MB</p>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc"
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                  className="mt-4 text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              {resumeFile && (
                <div className="text-xs text-slate-600 font-medium">
                  Selected file: <span className="font-bold">{resumeFile.name}</span> ({(resumeFile.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              )}

              <button
                type="submit"
                disabled={!resumeFile || uploadingResume}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
              >
                {uploadingResume ? "Uploading..." : "Upload Resume"}
              </button>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: SKILLS */}
        {/* ========================================================================= */}
        {activeTab === "skills" && (
          <div>
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Your Technical Skills</h2>
                <p className="text-sm text-slate-500">Track and manage self-declared, observed, and verified skills.</p>
              </div>
            </div>

            {/* Add skill input */}
            <form onSubmit={handleAddSkill} className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Skill Name</label>
                <input
                  type="text"
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  placeholder="e.g. TypeScript, React, Docker"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="w-full sm:w-48">
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Proficiency</label>
                <select
                  value={newSkillLevel}
                  onChange={(e) => setNewSkillLevel(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="BEGINNER">Beginner</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="ADVANCED">Advanced</option>
                  <option value="EXPERT">Expert</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={addingSkill || !newSkillName.trim()}
                className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-md transition-all disabled:opacity-50"
              >
                {addingSkill ? "Adding..." : "Add Skill"}
              </button>
            </form>

            {/* Skills list */}
            {skills.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No skills added yet. Add your primary technical competencies above.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {skills.map((s) => (
                  <div key={s.id} className="p-4 rounded-2xl bg-white border border-slate-200/70 hover:border-slate-300 transition-all flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{s.skill?.name || (s as any).skillName || "Skill"}</span>
                        {statusBadge(s.verificationStatus)}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Level: {s.declaredLevel || "Self-Declared"}</p>
                    </div>

                    <button
                      onClick={() => handleDeleteSkill(s.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Remove skill"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: PROJECTS */}
        {/* ========================================================================= */}
        {activeTab === "projects" && (
          <div>
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Portfolio Projects</h2>
                <p className="text-sm text-slate-500">Showcase your personal and academic software projects.</p>
              </div>

              <button
                onClick={() => setShowProjectModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-md transition-all self-start sm:self-auto"
              >
                + Add Project
              </button>
            </div>

            {/* Projects list */}
            {projects.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No projects added yet. Click "+ Add Project" to build your portfolio.
              </div>
            ) : (
              <div className="space-y-4">
                {projects.map((p) => (
                  <div key={p.id} className="p-5 rounded-2xl bg-white border border-slate-200/80 hover:shadow-sm transition-all">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-base text-slate-900">{p.title}</h3>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{p.description}</p>
                      </div>

                      <button
                        onClick={() => handleDeleteProject(p.id)}
                        className="text-xs font-semibold text-rose-500 hover:text-rose-700 px-2.5 py-1 rounded-lg hover:bg-rose-50 transition-colors"
                      >
                        Delete
                      </button>
                    </div>

                    {p.personalContribution && (
                      <p className="text-xs text-slate-500 mt-2">
                        <span className="font-semibold text-slate-700">Contribution: </span>
                        {p.personalContribution}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2 items-center">
                      {p.repositoryUrl && (
                        <a
                          href={p.repositoryUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                        >
                          🔗 GitHub Repo
                        </a>
                      )}
                      {p.demoUrl && (
                        <a
                          href={p.demoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline"
                        >
                          🚀 Live Demo
                        </a>
                      )}
                      {p.skills?.map((s, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-medium rounded-md">
                          {s.skill.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Modal for adding project */}
            {showProjectModal && (
              <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Add New Project</h3>
                  <form onSubmit={handleCreateProject} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Title</label>
                      <input
                        type="text"
                        required
                        value={projectForm.title}
                        onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                        placeholder="e.g. Distributed Task Scheduler"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Description</label>
                      <textarea
                        rows={2}
                        required
                        value={projectForm.description}
                        onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                        placeholder="Describe the problem, architecture, and results..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Your Contribution</label>
                      <input
                        type="text"
                        value={projectForm.personalContribution}
                        onChange={(e) => setProjectForm({ ...projectForm, personalContribution: e.target.value })}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                        placeholder="e.g. Designed database schema & auth"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Repo URL</label>
                        <input
                          type="url"
                          value={projectForm.repositoryUrl}
                          onChange={(e) => setProjectForm({ ...projectForm, repositoryUrl: e.target.value })}
                          className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                          placeholder="https://github.com/..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Demo URL</label>
                        <input
                          type="url"
                          value={projectForm.demoUrl}
                          onChange={(e) => setProjectForm({ ...projectForm, demoUrl: e.target.value })}
                          className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                          placeholder="https://..."
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Tech Stack (comma separated)</label>
                      <input
                        type="text"
                        value={projectForm.skillNames}
                        onChange={(e) => setProjectForm({ ...projectForm, skillNames: e.target.value })}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                        placeholder="TypeScript, PostgreSQL, Docker"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-3">
                      <button
                        type="button"
                        onClick={() => setShowProjectModal(false)}
                        className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={creatingProject}
                        className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl"
                      >
                        {creatingProject ? "Creating..." : "Save Project"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: JOBS */}
        {/* ========================================================================= */}
        {activeTab === "jobs" && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900">Campus Opportunities</h2>
              <p className="text-sm text-slate-500">Explore openings published by campus recruitment partners.</p>
            </div>

            {jobMsg && (
              <div
                className={`p-4 rounded-xl mb-6 text-sm font-medium ${
                  jobMsg.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {jobMsg.text}
              </div>
            )}

            {jobs.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No active jobs published right now. Check back soon!
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.map((job) => {
                  const applied = applications.some((a) => a.jobPosting?.id === job.id);
                  return (
                    <div key={job.id} className="p-5 rounded-2xl bg-white border border-slate-200/80 hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base text-slate-900">{job.title}</h3>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">
                            {job.employmentType}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {job.recruiterProfile?.company?.name || "Partner Company"} • {job.location || "Remote"} • {job.workMode}
                        </p>
                        <p className="text-xs text-slate-600 mt-2 line-clamp-2 max-w-xl">{job.description}</p>
                      </div>

                      <button
                        onClick={() => handleApplyJob(job.id)}
                        disabled={applied || applyingJobId === job.id}
                        className={`px-5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                          applied
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-not-allowed"
                            : "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
                        }`}
                      >
                        {applied ? "✓ Applied" : applyingJobId === job.id ? "Applying..." : "Apply Now"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: APPLICATIONS */}
        {/* ========================================================================= */}
        {activeTab === "applications" && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900">Your Applications</h2>
              <p className="text-sm text-slate-500">Track application status history and recruiter updates.</p>
            </div>

            {applications.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                You haven't submitted any job applications yet.
              </div>
            ) : (
              <div className="space-y-4">
                {applications.map((app) => (
                  <div key={app.id} className="p-5 rounded-2xl bg-white border border-slate-200/80 hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-slate-900">{app.jobPosting?.title || "Role"}</h3>
                        <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800">
                          {app.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Applied on {new Date(app.appliedAt).toLocaleDateString()}
                      </p>
                    </div>

                    {app.status !== "WITHDRAWN" && !["HIRED", "REJECTED"].includes(app.status) && (
                      <button
                        onClick={() => handleWithdrawApplication(app.id)}
                        className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors"
                      >
                        Withdraw
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
