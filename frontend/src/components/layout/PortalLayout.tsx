import React, { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export interface PortalNavItem {
  to: string;
  label: string;
  end?: boolean;
}

/** Sidebar shell shared by the recruiter and placement portals (the student dashboard has its own layout). */
export const PortalLayout: React.FC<{ portal: string; accent: "purple" | "emerald"; nav: PortalNavItem[] }> = ({ portal, accent, nav }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const active = accent === "purple" ? "bg-purple-600 text-white shadow-md shadow-purple-500/20" : "bg-emerald-600 text-white shadow-md shadow-emerald-500/20";
  const badge = accent === "purple" ? "bg-purple-100 text-purple-700" : "bg-emerald-100 text-emerald-700";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800">
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200">
        <span className="font-bold text-slate-900">
          Placement<span className="text-blue-600">Hub</span> <span className="text-xs text-slate-500">{portal}</span>
        </span>
        <button onClick={() => setOpen(!open)} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold" aria-label="Menu">
          Menu
        </button>
      </div>

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200/80 transform transition-transform duration-200 md:translate-x-0 md:static ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="h-full flex flex-col justify-between p-4">
          <div>
            <Link to="/" className="flex items-center gap-2.5 pb-5 px-2 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold">P</div>
              <span className="text-lg font-bold tracking-tight text-slate-900">
                Placement<span className="text-blue-600">Hub</span>
              </span>
            </Link>
            <div className="my-5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <h4 className="text-xs font-bold text-slate-900 truncate">{user?.name || user?.email}</h4>
              <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
              <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${badge}`}>{portal}</span>
            </div>
            <nav className="space-y-1">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => `block px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${isActive ? active : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <button
            onClick={async () => {
              await logout();
              navigate("/");
            }}
            className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
        <Outlet />
      </main>
    </div>
  );
};
