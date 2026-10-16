import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  fetchStudentProfile,
  fetchStudentSkills,
  fetchStudentProjects,
  fetchApplications,
  type StudentProfileData,
} from "../../api/student";

export const OverviewPage: React.FC = () => {
  const { user, accessToken } = useAuth();
  const [profile, setProfile] = useState<StudentProfileData | null>(null);
  const [skillsCount, setSkillsCount] = useState(0);
  const [projectsCount, setProjectsCount] = useState(0);
  const [applicationsCount, setApplicationsCount] = useState(0);

  useEffect(() => {
    if (!accessToken) return;

    fetchStudentProfile(accessToken).then(setProfile).catch(() => {});
    fetchStudentSkills(accessToken).then((s) => setSkillsCount(s.length)).catch(() => {});
    fetchStudentProjects(accessToken).then((p) => setProjectsCount(p.length)).catch(() => {});
    fetchApplications(accessToken).then((a) => setApplicationsCount(a.length)).catch(() => {});
  }, [accessToken]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome Hero Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-8 sm:p-10 text-white shadow-xl shadow-blue-500/15 relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-bold text-blue-100 mb-2">
            <span>🎓 Student Placement Hub</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Welcome back, {user?.name || "Student"}!
          </h1>
          <p className="text-xs sm:text-sm text-blue-100 max-w-xl leading-relaxed">
            {profile?.institution?.name
              ? `${profile.institution.name} • ${profile.degree || "Degree Candidate"}`
              : "Complete your academic profile and add verified skills to unlock campus opportunities."}
          </p>
        </div>

        {/* Decorative circle */}
        <div className="absolute right-0 bottom-0 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/dashboard/profile"
          className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm hover:border-blue-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Profile Status</span>
            <span className="text-xl">👤</span>
          </div>
          <div className="text-2xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">
            {profile?.cgpa ? "Active" : "Setup Needed"}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {profile?.cgpa ? `CGPA: ${profile.cgpa}` : "Configure degree & CGPA"}
          </p>
        </Link>

        <Link
          to="/dashboard/skills"
          className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm hover:border-blue-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Technical Skills</span>
            <span className="text-xl">⚡</span>
          </div>
          <div className="text-2xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">
            {skillsCount}
          </div>
          <p className="text-xs text-slate-500 mt-1">Assigned skills & evidence</p>
        </Link>

        <Link
          to="/dashboard/projects"
          className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm hover:border-blue-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Projects</span>
            <span className="text-xl">💻</span>
          </div>
          <div className="text-2xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">
            {projectsCount}
          </div>
          <p className="text-xs text-slate-500 mt-1">Showcase repositories</p>
        </Link>

        <Link
          to="/dashboard/applications"
          className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm hover:border-blue-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Applications</span>
            <span className="text-xl">📨</span>
          </div>
          <div className="text-2xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">
            {applicationsCount}
          </div>
          <p className="text-xs text-slate-500 mt-1">Active job applications</p>
        </Link>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              📄
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Upload Your Latest Resume</h3>
              <p className="text-xs text-slate-500">Keep your PDF or DOCX resume on file for campus recruiters.</p>
            </div>
          </div>
          <Link
            to="/dashboard/resume"
            className="inline-block px-4 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-bold text-xs rounded-xl transition"
          >
            Upload Resume →
          </Link>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
              💼
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Explore Campus Openings</h3>
              <p className="text-xs text-slate-500">Apply to jobs published by our partner recruitment companies.</p>
            </div>
          </div>
          <Link
            to="/dashboard/jobs"
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition"
          >
            Browse Openings →
          </Link>
        </div>
      </div>
    </div>
  );
};
