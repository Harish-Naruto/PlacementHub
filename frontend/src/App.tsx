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
import { JobDetailPage } from "./pages/dashboard/JobDetailPage";
import { ResumeBuilderPage } from "./pages/dashboard/ResumeBuilderPage";

// Recruiter portal
import { PortalLayout } from "./components/layout/PortalLayout";
import { RecruiterJobsPage } from "./pages/recruiter/RecruiterJobsPage";
import { RecruiterProfilePage } from "./pages/recruiter/RecruiterProfilePage";
import { RecruiterPostJobPage } from "./pages/recruiter/RecruiterPostJobPage";
import { RecruiterJobDetailPage } from "./pages/recruiter/RecruiterJobDetailPage";

// Placement team portal
import { PlacementOverviewPage } from "./pages/placement/PlacementOverviewPage";
import { PlacementIngestPage } from "./pages/placement/PlacementIngestPage";
import { PlacementJobsPage } from "./pages/placement/PlacementJobsPage";
import { PlacementRankPage } from "./pages/placement/PlacementRankPage";
import { PlacementPipelinePage } from "./pages/placement/PlacementPipelinePage";
import { PlacementStudentsPage } from "./pages/placement/PlacementStudentsPage";

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
              <ProtectedRoute allowedRoles={["STUDENT"]}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<OverviewPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="resume" element={<ResumePage />} />
            <Route path="skills" element={<SkillsPage />} />
            <Route path="assessment" element={<AssessmentPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="jobs" element={<JobsPage />} />
            <Route path="jobs/:jobId" element={<JobDetailPage />} />
            <Route path="jobs/:jobId/resume" element={<ResumeBuilderPage />} />
            <Route path="applications" element={<ApplicationsPage />} />
          </Route>

          {/* Recruiter portal */}
          <Route
            path="/recruiter"
            element={
              <ProtectedRoute allowedRoles={["RECRUITER"]}>
                <PortalLayout
                  portal="Recruiter"
                  accent="purple"
                  nav={[
                    { to: "/recruiter", label: "My jobs", end: true },
                    { to: "/recruiter/jobs/new", label: "Post a job" },
                    { to: "/recruiter/profile", label: "Company profile" },
                  ]}
                />
              </ProtectedRoute>
            }
          >
            <Route index element={<RecruiterJobsPage />} />
            <Route path="profile" element={<RecruiterProfilePage />} />
            <Route path="jobs/new" element={<RecruiterPostJobPage />} />
            <Route path="jobs/:jobId" element={<RecruiterJobDetailPage />} />
          </Route>

          {/* Placement team portal */}
          <Route
            path="/placement"
            element={
              <ProtectedRoute allowedRoles={["PLACEMENT"]}>
                <PortalLayout
                  portal="Placement team"
                  accent="emerald"
                  nav={[
                    { to: "/placement", label: "Overview", end: true },
                    { to: "/placement/ingest", label: "Ingest openings" },
                    { to: "/placement/jobs", label: "Openings" },
                    { to: "/placement/rank", label: "Batch ranking" },
                    { to: "/placement/pipeline", label: "Pipeline" },
                    { to: "/placement/students", label: "Students" },
                  ]}
                />
              </ProtectedRoute>
            }
          >
            <Route index element={<PlacementOverviewPage />} />
            <Route path="ingest" element={<PlacementIngestPage />} />
            <Route path="jobs" element={<PlacementJobsPage />} />
            <Route path="rank" element={<PlacementRankPage />} />
            <Route path="pipeline" element={<PlacementPipelinePage />} />
            <Route path="students" element={<PlacementStudentsPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
