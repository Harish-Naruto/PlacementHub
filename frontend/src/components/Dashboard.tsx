import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { testRecruiterCheckApi } from "../api/auth";

interface DashboardProps {
  onStartAssessment?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onStartAssessment }) => {
  const { user, accessToken, logout } = useAuth();
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<"idle" | "success" | "error">("idle");
  const [loadingTest, setLoadingTest] = useState(false);

  if (!user) return null;

  const handleTestRecruiterRoute = async () => {
    if (!accessToken) return;
    setLoadingTest(true);
    setTestResult(null);
    try {
      const res = await testRecruiterCheckApi(accessToken);
      setTestStatus("success");
      setTestResult(res.message);
    } catch (err) {
      setTestStatus("error");
      setTestResult(err instanceof Error ? err.message : "Access denied");
    } finally {
      setLoadingTest(false);
    }
  };

  return (
    <div className="w-full max-w-2xl bg-white rounded-3xl shadow-[0_25px_60px_-15px_rgba(30,64,175,0.12)] border border-slate-100 p-8 sm:p-10 transition-all">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-md ${
              user.role === "STUDENT"
                ? "bg-gradient-to-br from-sky-400 to-blue-600 shadow-blue-500/20"
                : "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-purple-500/20"
            }`}
          >
            {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{user.name || "PlacementHub User"}</h2>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="px-4 py-2 text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-xl transition duration-150"
        >
          Sign Out
        </button>
      </div>

      {/* User Information Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Account Role</span>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                user.role === "STUDENT"
                  ? "bg-sky-100 text-sky-800 border border-sky-200"
                  : "bg-purple-100 text-purple-800 border border-purple-200"
              }`}
            >
              {user.role}
            </span>
            <span className="text-xs text-slate-500">
              {user.role === "STUDENT" ? "Student Candidate" : "Hiring Recruiter"}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">User ID</span>
          <p className="mt-1 text-xs font-mono text-slate-700 truncate" title={user.id}>
            {user.id}
          </p>
        </div>
      </div>

      {/* Security & Token Section */}
      <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Access Token (HS256 JWT)</span>
        <p className="mt-1 text-xs font-mono text-slate-600 break-all bg-white p-3 rounded-xl border border-slate-200/70">
          {accessToken ? `${accessToken.slice(0, 32)}...${accessToken.slice(-16)}` : "None"}
        </p>
        <p className="mt-2 text-xs text-slate-400">
          ✓ Refresh token is safely stored inside an HttpOnly, SameSite cookie and automatically rotated.
        </p>
      </div>

      {/* Role-Based Guard Testing Area */}
      <div className="p-5 rounded-2xl bg-blue-50/60 border border-blue-100">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Test Role-Based Protection</h3>
            <p className="text-xs text-slate-500">
              Pings <code className="text-blue-700 bg-blue-100/70 px-1 py-0.5 rounded">/api/v1/auth/recruiter-check</code> (Requires RECRUITER role)
            </p>
          </div>

          <button
            onClick={handleTestRecruiterRoute}
            disabled={loadingTest}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition duration-150 disabled:opacity-50 shrink-0"
          >
            {loadingTest ? "Checking..." : "Execute Test"}
          </button>
        </div>

        {testResult && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
              testStatus === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-amber-50 text-amber-800 border border-amber-200"
            }`}
          >
            {testStatus === "success" ? (
              <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            <span>{testResult}</span>
          </div>
        )}
      </div>
      {/* Start Assessment CTA */}
      {user.role === "STUDENT" && onStartAssessment && (
        <div className="mt-6 p-5 rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200/60">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">AI Skill Assessment</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Take a personalised technical assessment generated from your resume by Gemini AI.
              </p>
            </div>
            <button
              id="start-assessment-btn"
              onClick={onStartAssessment}
              className="shrink-0 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-xl shadow-md shadow-violet-500/20 transition-all duration-150 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Start Assessment
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
