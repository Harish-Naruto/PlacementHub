import React from "react";

interface StatusBadgeProps {
  status: string;
  type?: "skill" | "application" | "job";
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = "skill" }) => {
  if (type === "skill") {
    switch (status) {
      case "EVALUATED":
      case "VERIFIED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Verified
          </span>
        );
      case "REPOSITORY_OBSERVED":
      case "OBSERVED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-300 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Observed in Code
          </span>
        );
      case "SELF_DECLARED":
      case "UNVERIFIED":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Unverified (User Mentioned)
          </span>
        );
    }
  }

  // Application Status
  switch (status) {
    case "APPLIED":
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">Applied</span>;
    case "IN_REVIEW":
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">In Review</span>;
    case "SHORTLISTED":
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">Shortlisted</span>;
    case "INTERVIEW_SCHEDULED":
    case "INTERVIEWING":
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">Interviewing</span>;
    case "OFFERED":
    case "HIRED":
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">Offered</span>;
    case "REJECTED":
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">Rejected</span>;
    case "WITHDRAWN":
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">Withdrawn</span>;
    default:
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800">{status}</span>;
  }
};
