import React from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AuthCard } from "./components/AuthCard";
import { Dashboard } from "./components/Dashboard";
import { RecruiterDashboard } from "./components/recruiter/RecruiterDashboard";
import { ErrorBoundary } from "./components/ErrorBoundary";

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 bg-gradient-to-br from-[#0f0f1a] via-[#141428] to-[#0d1117]">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-400">Connecting to PlacementHub...</p>
      </div>
    );
  }

  // Recruiters get the full-screen dark dashboard
  if (user?.role === "RECRUITER") {
    return <RecruiterDashboard />;
  }

  // Students (and unauthenticated) get the existing light auth/dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8faff] via-[#f0f4ff] to-[#fdf4ff] text-slate-800 flex flex-col items-center justify-between p-4 sm:p-8 font-sans selection:bg-blue-500 selection:text-white">
      {/* Subtle Top Navigation / Brand */}
      <header className="w-full max-w-5xl flex items-center justify-between py-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black tracking-tight text-slate-900">Placement<span className="text-blue-600">Hub</span></span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Beta</span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-500 bg-white/70 backdrop-blur-sm border border-slate-200/80 px-3 py-1.5 rounded-full shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>API Online • JWT Authentication Active</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full flex items-center justify-center flex-1 my-auto">
        <div className="w-full flex items-center justify-center animate-in fade-in duration-300">
          {user ? <Dashboard /> : <AuthCard />}
        </div>
      </main>

      {/* Subtle Footer */}
      <footer className="w-full text-center py-6 text-xs text-slate-400">
        <p>© 2026 PlacementHub. Secure role-based JWT authentication with HttpOnly session cookies.</p>
      </footer>
    </div>
  );
};

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
