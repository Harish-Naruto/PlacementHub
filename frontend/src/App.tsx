import React, { useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AuthCard } from "./components/AuthCard";
import { Dashboard } from "./components/Dashboard";
import AssessmentPage from "./pages/AssessmentPage";

// ---------------------------------------------------------------------------
// Home shell — handles the branded light-gradient layout for auth + dashboard
// ---------------------------------------------------------------------------

const HomeShell: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f8faff] via-[#f0f4ff] to-[#fdf4ff] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-500">Connecting to PlacementHub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8faff] via-[#f0f4ff] to-[#fdf4ff] text-slate-800 flex flex-col items-center justify-between p-4 sm:p-8 font-sans selection:bg-blue-500 selection:text-white">
      {/* Brand header */}
      <header className="w-full max-w-5xl flex items-center justify-between py-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black tracking-tight text-slate-900">
              Placement<span className="text-blue-600">Hub</span>
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              Stage 1
            </span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-500 bg-white/70 backdrop-blur-sm border border-slate-200/80 px-3 py-1.5 rounded-full shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>API Online • JWT Authentication Active</span>
        </div>
      </header>

      {/* Main content */}
      <main className="w-full flex items-center justify-center flex-1 my-auto">
        <div className="w-full flex items-center justify-center animate-in fade-in duration-300">
          {user ? (
            <Dashboard onStartAssessment={() => navigate("/assessment")} />
          ) : (
            <AuthCard />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-6 text-xs text-slate-400">
        <p>© 2026 PlacementHub. Secure role-based JWT authentication with HttpOnly session cookies.</p>
      </footer>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Assessment route wrapper — full-screen dark layout
// ---------------------------------------------------------------------------

const AssessmentRoute: React.FC = () => {
  const navigate = useNavigate();
  return <AssessmentPage onBack={() => navigate("/")} />;
};

// ---------------------------------------------------------------------------
// Root App
// ---------------------------------------------------------------------------

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomeShell />} />
          <Route path="/assessment" element={<AssessmentRoute />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
