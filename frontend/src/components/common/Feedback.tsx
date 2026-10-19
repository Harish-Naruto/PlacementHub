import React from "react";

export const Loading: React.FC<{ label?: string }> = ({ label = "Loading..." }) => (
  <div className="flex items-center justify-center gap-3 py-16 text-sm font-medium text-slate-500">
    <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    {label}
  </div>
);

export const ErrorBox: React.FC<{ message: string | null; onRetry?: () => void }> = ({ message, onRetry }) =>
  message ? (
    <div role="alert" className="p-4 rounded-xl bg-rose-50 text-rose-800 text-xs font-semibold border border-rose-200 flex items-center justify-between gap-3">
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="px-3 py-1 rounded-lg bg-white border border-rose-200 hover:bg-rose-100">
          Retry
        </button>
      )}
    </div>
  ) : null;

export const Empty: React.FC<{ title: string; hint?: string; children?: React.ReactNode }> = ({ title, hint, children }) => (
  <div className="text-center py-14 px-4 bg-white rounded-2xl border border-dashed border-slate-300">
    <p className="text-sm font-bold text-slate-700">{title}</p>
    {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    {children && <div className="mt-4">{children}</div>}
  </div>
);

export const PageHeader: React.FC<{ title: string; subtitle?: string; actions?: React.ReactNode }> = ({ title, subtitle, actions }) => (
  <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
    <div>
      <h1 className="text-xl font-black text-slate-900 tracking-tight">{title}</h1>
      {subtitle && <p className="text-xs text-slate-500 mt-1 max-w-2xl">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);
