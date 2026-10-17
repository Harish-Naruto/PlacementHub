import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { MainLayout } from "./components/layout/MainLayout";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { ProtectedRoute } from "./components/common/ProtectedRoute";

// Public Pages
import { HomePage } from "./pages/HomePage";
import { AboutPage } from "./pages/AboutPage";
import { PublicJobsPage } from "./pages/PublicJobsPage";
import { SignInPage } from "./pages/SignInPage";
import { SignUpPage } from "./pages/SignUpPage";

// Dashboard Pages
import { OverviewPage } from "./pages/dashboard/OverviewPage";
import { ProfilePage } from "./pages/dashboard/ProfilePage";
import { ResumePage } from "./pages/dashboard/ResumePage";
import { SkillsPage } from "./pages/dashboard/SkillsPage";
import { AssessmentPage } from "./pages/dashboard/AssessmentPage";
import { ProjectsPage } from "./pages/dashboard/ProjectsPage";
import { JobsPage } from "./pages/dashboard/JobsPage";
import { ApplicationsPage } from "./pages/dashboard/ApplicationsPage";

import { useAuth } from "./context/AuthContext";

// Recruiter Pages
import { RecruiterOverviewPage } from "./pages/recruiter/RecruiterOverviewPage";
import { RecruiterJobsPage } from "./pages/recruiter/RecruiterJobsPage";
import { PostJobPage } from "./pages/recruiter/PostJobPage";
import { JobApplicantsPage } from "./pages/recruiter/JobApplicantsPage";
import { CompanyProfilePage } from "./pages/recruiter/CompanyProfilePage";

function DashboardIndex() {
  const { user } = useAuth();
  if (user?.role === "RECRUITER") {
    return <RecruiterOverviewPage />;
  }
  return <OverviewPage />;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes with Navbar and Footer */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/jobs" element={<PublicJobsPage />} />
          </Route>

          {/* Authentication Pages */}
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/signup" element={<SignUpPage />} />

          {/* Protected Dashboard Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            {/* Role-adaptive index */}
            <Route index element={<DashboardIndex />} />

            {/* Student Hub Routes */}
            <Route path="profile" element={<ProfilePage />} />
            <Route path="resume" element={<ResumePage />} />
            <Route path="skills" element={<SkillsPage />} />
            <Route path="assessment" element={<AssessmentPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="jobs" element={<JobsPage />} />
            <Route path="applications" element={<ApplicationsPage />} />

            {/* Recruiter Hub Routes */}
            <Route path="recruiter/jobs" element={<RecruiterJobsPage />} />
            <Route path="recruiter/jobs/new" element={<PostJobPage />} />
            <Route path="recruiter/jobs/:jobId/applicants" element={<JobApplicantsPage />} />
            <Route path="recruiter/company" element={<CompanyProfilePage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
