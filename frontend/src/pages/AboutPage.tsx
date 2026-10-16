import React from "react";
import { Link } from "react-router-dom";

export const AboutPage: React.FC = () => {
  const partnerColleges = [
    { name: "D.Y. Patil University", location: "Pune, Maharashtra", icon: "🏛️" },
    { name: "Indian Institute of Technology Bombay", location: "Mumbai, Maharashtra", icon: "🔬" },
    { name: "COEP Technological University", location: "Pune, Maharashtra", icon: "⚡" },
    { name: "Pune Institute of Computer Technology", location: "Pune, Maharashtra", icon: "💻" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
      {/* Intro */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">About PlacementHub</h1>
        <p className="text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
          We are transforming campus hiring by replacing unstructured paper resumes with verified skill graphs, reproducible evidence, and direct employer engagement.
        </p>
      </div>

      {/* Mission */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-white p-8 sm:p-10 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Our Mission</span>
          <h2 className="text-2xl font-bold text-slate-900 leading-snug">
            Bridging Academic Potential and Industry Reality
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Traditional placement processes rely on static resumes that reward keyword stuffing over authentic capability. PlacementHub provides students with an immutable portfolio where every skill is supported by real repository commits, architecture contributions, and institutional records.
          </p>
        </div>

        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">✓</span>
            <span className="text-xs font-bold text-slate-800">No automated ATS resume discards</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm">✓</span>
            <span className="text-xs font-bold text-slate-800">Verified institutional student records</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm">✓</span>
            <span className="text-xs font-bold text-slate-800">Direct hiring without middlemen</span>
          </div>
        </div>
      </div>

      {/* Partner Institutions */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900">Partner Educational Institutions</h2>
          <p className="text-xs text-slate-500 mt-1">Integrated directly with university training & placement cells</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {partnerColleges.map((inst, idx) => (
            <div key={idx} className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="text-2xl">{inst.icon}</div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">{inst.name}</h4>
                <p className="text-xs text-slate-500">{inst.location}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action */}
      <div className="text-center pt-8">
        <Link
          to="/signup"
          className="inline-block px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/25 transition"
        >
          Create Student Profile Today →
        </Link>
      </div>
    </div>
  );
};
