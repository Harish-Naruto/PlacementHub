import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import type { RecruiterProfileData } from "../../api/recruiter";

export type RecruiterView =
  | "overview"
  | "jobs"
  | "post-job"
  | "job-detail";

interface RecruiterLayoutProps {
  activeView: RecruiterView;
  onNavigate: (view: RecruiterView) => void;
  profile?: RecruiterProfileData | null;
  onOpenProfile: () => void;
  children: React.ReactNode;
}

const navItems: { id: RecruiterView; label: string; icon: React.ReactNode }[] = [
  {
    id: "overview",
    label: "Overview",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
  {
    id: "jobs",
    label: "My Job Postings",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "post-job",
    label: "Post a Job",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
];

export const RecruiterLayout: React.FC<RecruiterLayoutProps> = ({
  activeView,
  onNavigate,
  profile,
  onOpenProfile,
  children,
}) => {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email.slice(0, 2).toUpperCase() ?? "?";

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-[#0f0f1a] via-[#141428] to-[#0d1117] text-white">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col w-64 bg-[#13132a]/90 backdrop-blur-xl border-r border-white/[0.07] shadow-2xl transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 lg:static lg:flex`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/[0.07]">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <span className="text-base font-black tracking-tight">
              Placement<span className="text-indigo-400">Hub</span>
            </span>
            <div className="text-[10px] text-purple-400 font-semibold uppercase tracking-widest">Recruiter</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-left ${
                  active
                    ? "bg-indigo-600/25 text-indigo-300 border border-indigo-500/30 shadow-inner"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
                }`}
              >
                <span className={active ? "text-indigo-400" : "text-slate-500"}>{item.icon}</span>
                {item.label}
                {item.id === "post-job" && (
                  <span className="ml-auto w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User card with quick edit company profile option */}
        <div className="px-4 py-4 border-t border-white/[0.07]">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold shrink-0 shadow-lg shadow-indigo-500/20">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.name ?? "Recruiter"}</p>
              <p className="text-xs text-slate-500 truncate">{profile?.company?.name ?? user?.email}</p>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-0">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex items-center gap-3 sm:gap-4 px-6 py-4 bg-[#0d0d1e]/80 backdrop-blur-xl border-b border-white/[0.06]">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex-1" />

          {/* API Status badge */}
          <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            API Online
          </div>

          {/* Post Job shortcut button */}
          <button
            onClick={() => onNavigate("post-job")}
            className="flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:shadow-indigo-500/40"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden xs:inline">Post Job</span>
          </button>

          {/* Company Profile Logo & Edit Button at top right */}
          <button
            type="button"
            onClick={onOpenProfile}
            title={profile?.company?.name ? `${profile.company.name} (Click to edit company profile)` : "Click to set up company profile"}
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 hover:border-indigo-500/40 transition-all duration-200 group text-left cursor-pointer shadow-sm"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-black text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform shrink-0">
              {profile?.company?.name ? profile.company.name.charAt(0).toUpperCase() : "🏢"}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors truncate max-w-[140px]">
                {profile?.company?.name || "Company Profile"}
              </div>
              <div className="text-[10px] text-slate-400 font-medium">Edit Profile</div>
            </div>
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
};
