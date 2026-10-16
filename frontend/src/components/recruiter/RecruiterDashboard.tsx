import React, { useEffect, useState } from "react";
import { RecruiterLayout, type RecruiterView } from "./RecruiterLayout";
import { RecruiterOverview } from "./RecruiterOverview";
import { RecruiterProfile } from "./RecruiterProfile";
import { RecruiterJobList } from "./RecruiterJobList";
import { RecruiterPostJob } from "./RecruiterPostJob";
import { RecruiterJobDetail } from "./RecruiterJobDetail";
import { useAuth } from "../../context/AuthContext";
import { getRecruiterProfile, type RecruiterProfileData } from "../../api/recruiter";

export const RecruiterDashboard: React.FC = () => {
  const { accessToken } = useAuth();
  const [view, setView] = useState<RecruiterView>("overview");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [profile, setProfile] = useState<RecruiterProfileData | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    getRecruiterProfile(accessToken)
      .then((data) => setProfile(data))
      .catch(() => {});
  }, [accessToken]);

  const navigate = (v: RecruiterView, jobId?: string) => {
    setView(v);
    if (jobId) setActiveJobId(jobId);
  };

  return (
    <>
      <RecruiterLayout
        activeView={view}
        onNavigate={navigate}
        profile={profile}
        onOpenProfile={() => setIsProfileOpen(true)}
      >
        {view === "overview" && (
          <RecruiterOverview
            onNavigate={(v, jobId) => navigate(v, jobId)}
            onOpenProfile={() => setIsProfileOpen(true)}
          />
        )}
        {view === "jobs" && (
          <RecruiterJobList
            onNavigate={(v, jobId) => navigate(v, jobId)}
          />
        )}
        {view === "post-job" && (
          <RecruiterPostJob
            onSuccess={(jobId) => navigate("job-detail", jobId)}
            onNavigateProfile={() => setIsProfileOpen(true)}
          />
        )}
        {view === "job-detail" && (
          activeJobId ? (
            <RecruiterJobDetail
              jobId={activeJobId}
              onBack={() => navigate("jobs")}
            />
          ) : (
            <RecruiterJobList
              onNavigate={(v, jobId) => navigate(v, jobId)}
            />
          )
        )}
      </RecruiterLayout>

      {/* Company Profile Edit Modal */}
      <RecruiterProfile
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onProfileUpdated={(updated) => setProfile(updated)}
      />
    </>
  );
};
