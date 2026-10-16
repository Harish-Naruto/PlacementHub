import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

type RoleType = "STUDENT" | "RECRUITER";
type ModeType = "LOGIN" | "REGISTER";

export const AuthCard: React.FC = () => {
  const { login, register } = useAuth();

  const [role, setRole] = useState<RoleType>("STUDENT");
  const [mode, setMode] = useState<ModeType>("LOGIN");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      if (mode === "LOGIN") {
        await login(email, password, role);
      } else {
        await register({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          invitationCode: role === "RECRUITER" && invitationCode.trim() ? invitationCode.trim() : undefined,
        });
      }
    } catch (err) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[430px] bg-white rounded-3xl shadow-[0_25px_60px_-15px_rgba(30,64,175,0.12)] border border-slate-100 p-8 sm:p-9 transition-all">
      {/* Top Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
          {mode === "LOGIN" ? "Welcome Back" : "Create Account"}
        </h1>
        <p className="text-slate-500 text-sm mt-1.5 font-normal">
          {mode === "LOGIN"
            ? "Select your role and sign in to continue"
            : "Choose your role and register to get started"}
        </p>
      </div>

      {/* Role Selector Pill Bar */}
      <div className="bg-slate-100/90 p-1 rounded-2xl flex items-center justify-between mb-7 border border-slate-200/60">
        <button
          type="button"
          onClick={() => {
            setRole("STUDENT");
            setErrorMessage(null);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
            role === "STUDENT"
              ? "bg-[#0284c7] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Student
        </button>

        <button
          type="button"
          onClick={() => {
            setRole("RECRUITER");
            setErrorMessage(null);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
            role === "RECRUITER"
              ? "bg-[#0284c7] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Recruiter
        </button>
      </div>

      {/* Role Banner Card */}
      <div className="flex items-center gap-3.5 mb-6">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md ${
            role === "STUDENT"
              ? "bg-gradient-to-br from-sky-400 to-blue-600 shadow-blue-500/20"
              : "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-purple-500/20"
          }`}
        >
          {role === "STUDENT" ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          )}
        </div>

        <div>
          <h2 className="text-xl font-bold text-slate-900 leading-snug">
            {role === "STUDENT" ? "Student" : "Recruiter"} {mode === "LOGIN" ? "Login" : "Sign Up"}
          </h2>
          <p className="text-xs text-slate-500 leading-tight mt-0.5">
            {role === "STUDENT"
              ? "Access your placement profile and track applications"
              : "Post openings and hire pre-evaluated candidates"}
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200/80 flex items-start gap-2.5 text-red-700 text-xs sm:text-sm animate-in fade-in duration-200">
          <svg className="w-4 h-4 mt-0.5 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "REGISTER" && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full bg-[#f1f5fb] border border-[#d6e3f8] rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. name@example.com"
            className="w-full bg-[#f1f5fb] border border-[#d6e3f8] rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#f1f5fb] border border-[#d6e3f8] rounded-xl px-4 py-2.5 pr-11 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              {showPassword ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {mode === "REGISTER" && role === "RECRUITER" && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Recruiter Invitation Code <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={invitationCode}
              onChange={(e) => setInvitationCode(e.target.value)}
              placeholder="e.g. RECRUIT2026"
              className="w-full bg-[#f1f5fb] border border-[#d6e3f8] rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
            />
          </div>
        )}

        {/* Remember me & Forgot Password */}
        {mode === "LOGIN" && (
          <div className="flex items-center justify-between text-xs pt-1 pb-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-600 select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
              />
              <span>Remember me</span>
            </label>

            <a
              href="#forgot"
              onClick={(e) => {
                e.preventDefault();
                alert("Password reset functionality will be configured in Stage 2.");
              }}
              className="text-blue-600 hover:text-blue-700 font-medium transition"
            >
              Forgot password?
            </a>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-3.5 px-4 rounded-xl text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:opacity-95 active:scale-[0.99] flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Authenticating...</span>
            </div>
          ) : (
            <span>
              {mode === "LOGIN"
                ? `Sign In as ${role === "STUDENT" ? "Student" : "Recruiter"}`
                : `Register as ${role === "STUDENT" ? "Student" : "Recruiter"}`}
            </span>
          )}
        </button>
      </form>

      {/* Footer Switcher */}
      <div className="mt-7 text-center text-xs text-slate-500">
        {mode === "LOGIN" ? (
          <p>
            Don't have an account?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("REGISTER");
                setErrorMessage(null);
              }}
              className="text-blue-600 hover:text-blue-700 font-semibold transition"
            >
              Register here
            </button>
          </p>
        ) : (
          <p>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("LOGIN");
                setErrorMessage(null);
              }}
              className="text-blue-600 hover:text-blue-700 font-semibold transition"
            >
              Sign in here
            </button>
          </p>
        )}
      </div>
    </div>
  );
};
