import React from "react";
import { Link } from "react-router-dom";

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-slate-900 text-slate-300 border-t border-slate-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand & mission */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-base">
                P
              </div>
              <span className="text-xl font-bold text-white tracking-tight">Placement<span className="text-blue-500">Hub</span></span>
            </div>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              Empowering students with cryptographic skill verification, automated profile enrichment, and direct campus recruitment workflows.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3">Navigation</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link to="/" className="hover:text-white transition">Home</Link></li>
              <li><Link to="/about" className="hover:text-white transition">About Us</Link></li>
              <li><Link to="/jobs" className="hover:text-white transition">Job Board</Link></li>
              <li><Link to="/signin" className="hover:text-white transition">Student Portal</Link></li>
            </ul>
          </div>

          {/* Security & Tech */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3">Architecture</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>JWT HS256 Authentication</span>
              </li>
              <li><span>HttpOnly Cookie Rotation</span></li>
              <li><span>PostgreSQL + Prisma ORM</span></li>
              <li><span>Express 5 & Vite React</span></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2026 PlacementHub. All rights reserved.</p>
          <div className="flex gap-4">
            <span className="hover:text-slate-400 cursor-pointer">Privacy Policy</span>
            <span>•</span>
            <span className="hover:text-slate-400 cursor-pointer">Terms of Service</span>
            <span>•</span>
            <span className="hover:text-slate-400 cursor-pointer">Campus Helpdesk</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
