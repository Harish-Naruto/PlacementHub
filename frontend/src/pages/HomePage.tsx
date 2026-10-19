import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { homeFor } from "../lib/roles";

export const HomePage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-20 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 sm:pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-bold mb-8 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            <span>Next-Gen Campus Placement & Skill Verification Engine</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight max-w-4xl mx-auto leading-[1.15]">
            Land Your Dream Job with{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              Verified Evidence
            </span>
            , Not Just Keywords.
          </h1>

          <p className="mt-6 text-base sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            PlacementHub connects university students directly with campus recruiters through cryptographic skill verification, GitHub project evidence, and automated matching.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            {user ? (
              <Link
                to={homeFor(user.role)}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-xl shadow-blue-500/25 hover:scale-105 transition-all"
              >
                Go to My Dashboard →
              </Link>
            ) : (
              <>
                <Link
                  to="/signup"
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-xl shadow-blue-500/25 hover:scale-105 transition-all"
                >
                  Join as Student Candidate
                </Link>
                <Link
                  to="/jobs"
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm border border-slate-200 shadow-sm hover:scale-105 transition-all"
                >
                  Browse Campus Openings
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Decorative background blobs */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gradient-to-tr from-blue-400/10 to-purple-400/10 blur-3xl -z-10 rounded-full pointer-events-none"></div>
      </section>

      {/* Stats Counter */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-3xl sm:text-4xl font-black text-blue-600">100%</div>
            <div className="text-xs sm:text-sm font-semibold text-slate-500 mt-1">Verified Evidence</div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-black text-indigo-600">4+</div>
            <div className="text-xs sm:text-sm font-semibold text-slate-500 mt-1">Partner Institutions</div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-black text-purple-600">50+</div>
            <div className="text-xs sm:text-sm font-semibold text-slate-500 mt-1">Technical Skills</div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-black text-emerald-600">0%</div>
            <div className="text-xs sm:text-sm font-semibold text-slate-500 mt-1">ATS Keyword Games</div>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Engineered for the Modern Campus</h2>
          <p className="mt-3 text-sm text-slate-500 leading-relaxed">
            Eliminating resume screening black-boxes through transparent verification and direct institutional connections.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xl mb-6">
              🎯
            </div>
            <h3 className="text-lg font-bold text-slate-900">Cryptographic Verification</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Skills are proven through project repos, assessment engines, and observational metrics rather than self-reported buzzwords.
            </p>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xl mb-6">
              📂
            </div>
            <h3 className="text-lg font-bold text-slate-900">Direct Portfolio Hub</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Showcase architecture designs, personal code contributions, and live demos directly in your institutional profile.
            </p>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xl mb-6">
              ⚡
            </div>
            <h3 className="text-lg font-bold text-slate-900">One-Click Applications</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Apply to verified campus openings instantly with full transparency into review status, shortlist events, and interviews.
            </p>
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-10 sm:p-14 text-white text-center shadow-xl shadow-blue-500/20">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Ready to launch your engineering career?</h2>
          <p className="mt-4 text-blue-100 max-w-xl mx-auto text-sm sm:text-base">
            Create your profile, upload your resume, and start matching with campus recruiters today.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              to="/signup"
              className="px-8 py-3.5 bg-white text-blue-700 font-bold rounded-2xl shadow-lg hover:bg-blue-50 transition"
            >
              Get Started Now
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
