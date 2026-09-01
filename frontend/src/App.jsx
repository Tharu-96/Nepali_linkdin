import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { GoogleOAuthProvider } from '@react-oauth/google';
import { useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import RolePortalLayout from "./components/layout/RolePortalLayout";

const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Home = lazy(() => import("./pages/Home"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Jobs = lazy(() => import("./pages/Jobs"));
const JobDetails = lazy(() => import("./pages/JobDetails"));
const PostJob = lazy(() => import("./pages/PostJob"));
const EmployerJobs = lazy(() => import("./pages/employer/EmployerJobs"));
const EmployerPlatformJobs = lazy(() => import("./pages/employer/EmployerPlatformJobs"));
const JobApplications = lazy(() => import("./pages/JobApplications"));
const Profile = lazy(() => import("./pages/Profile"));
const Chat = lazy(() => import("./pages/Chat"));
const Chatbot = lazy(() => import("./pages/Chatbot"));
const GoogleCallback = lazy(() => import("./pages/auth/GoogleCallback"));
const SelectRole = lazy(() => import("./pages/auth/SelectRole"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const MarkComplete = lazy(() => import("./pages/employer/MarkComplete"));
const PayWorker = lazy(() => import("./pages/employer/PayWorker"));
const PaymentSuccess = lazy(() => import("./pages/employer/PaymentSuccess"));
const PaymentFailed = lazy(() => import("./pages/employer/PaymentFailed"));
const PaymentHistory = lazy(() => import("./pages/worker/PaymentHistory"));
const JobReview = lazy(() => import("./pages/JobReview"));
const Reviews = lazy(() => import("./pages/Reviews"));
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const AdminLogin = lazy(() => import("./pages/admin/Login"));
const AdminWorkers = lazy(() => import("./pages/admin/Workers"));
const AdminEmployers = lazy(() => import("./pages/admin/Employers"));
const AdminJobs = lazy(() => import("./pages/admin/Jobs"));
const AdminUserDetail = lazy(() => import("./pages/admin/UserDetail"));
const AdminTransactions = lazy(() => import("./pages/admin/Transactions"));
const AdminReviews = lazy(() => import("./pages/admin/Reviews"));
const AdminReports = lazy(() => import("./pages/admin/Reports"));
const AdminAuditLogs = lazy(() => import("./pages/admin/AuditLog"));

function RouteLoader() {
  return (
    <div className="page-loader">
      <div className="spinner" />
      <p>Loading page...</p>
    </div>
  );
}

function App() {
  const { loading, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const portalPaths = ["/dashboard", "/profile", "/jobs", "/reviews", "/chat", "/assistant", "/payment/history"];
  const hideNavbar =
    portalPaths.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`)) ||
    location.pathname.startsWith("/admin");

  // Redirect if token found globally
  useEffect(() => {
    const token = localStorage.getItem('rozgar_token');
    const path = window.location.pathname;
    if (token && (path === '/login' || path === '/register' || path === '/')) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  if (loading) {
    return (
      <div className="page-loader">
        <div className="spinner" />
        <p>Loading Rozgar...</p>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <div className="app">
        {!hideNavbar && <Navbar />}
        <main className="main-content">
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              {/* Public */}
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/chatbot"
                element={<Navigate to={role === "admin" ? "/admin/chatbot" : "/assistant"} replace />}
              />
              <Route path="/auth/google/callback" element={<GoogleCallback />} />
              <Route path="/select-role" element={<SelectRole />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected — Any role */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route element={<ProtectedRoute roles={["worker", "employer"]}><RolePortalLayout /></ProtectedRoute>}>
              <Route
                path="/jobs"
                element={role === "employer" ? <EmployerJobs /> : <Jobs />}
              />
              <Route path="/jobs/:jobId" element={<JobDetails />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/reviews" element={<Reviews />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/assistant" element={<Chatbot />} />
              <Route path="/payment/history" element={<PaymentHistory />} />
              <Route path="/jobs/:jobId/review" element={<JobReview />} />
              <Route path="/jobs/all" element={<ProtectedRoute roles={["employer"]}><EmployerPlatformJobs /></ProtectedRoute>} />
              <Route path="/employer/jobs" element={<ProtectedRoute roles={["employer"]}><EmployerJobs /></ProtectedRoute>} />
              <Route path="/jobs/post" element={<ProtectedRoute roles={["employer"]}><PostJob /></ProtectedRoute>} />
              <Route path="/jobs/:jobId/applications" element={<ProtectedRoute roles={["employer"]}><JobApplications /></ProtectedRoute>} />
              <Route path="/jobs/:jobId/complete" element={<ProtectedRoute roles={["employer"]}><MarkComplete /></ProtectedRoute>} />
              <Route path="/payment/pay/:jobId" element={<ProtectedRoute roles={["employer"]}><PayWorker /></ProtectedRoute>} />
            </Route>

            {/* Protected — Employer only */}

            {/* Payment Status (Any user involved) */}
            <Route path="/payment/success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
            <Route path="/payment/failed" element={<ProtectedRoute><PaymentFailed /></ProtectedRoute>} />

            {/* Reviews — available to employers after job completion to rate workers */}

            {/* Protected — Admin only */}
            <Route path="/admin" element={<ProtectedRoute roles={["admin"]}><AdminLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Navigate to="/dashboard" replace />} />
              <Route path="workers" element={<AdminWorkers />} />
              <Route path="employers" element={<AdminEmployers />} />
              <Route path="users/:id" element={<AdminUserDetail />} />
              <Route path="jobs" element={<AdminJobs />} />
              <Route path="transactions" element={<AdminTransactions />} />
              <Route path="reviews" element={<AdminReviews />} />
              <Route path="chatbot" element={<Chatbot />} />
              <Route path="audit-logs" element={<AdminAuditLogs />} />
              <Route path="reports" element={<AdminReports />} />
            </Route>

            {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;
