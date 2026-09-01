import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-loader">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(role)) {
    // For admin-only routes, hide existence by returning a 404-style response
    if (roles.includes("admin")) {
      return (
        <div className="page-container">
          <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
            <h2>404 — Not Found</h2>
            <p>The page you are looking for does not exist.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <h2>🚫 Access Denied</h2>
          <p>You do not have permission to view this page.</p>
          <p>Required role: <strong>{roles.join(" or ")}</strong></p>
        </div>
      </div>
    );
  }

  return children;
}
