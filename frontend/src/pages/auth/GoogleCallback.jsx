import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authAPI } from "../../api";

export default function GoogleCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const code = searchParams.get("code");

  const handleLogin = async (selectedCode) => {
    setLoading(true);
    setError("");
    try {
      const res = await authAPI.googleCallback({ code: selectedCode });
      if (res.data.needs_role_selection) {
        navigate("/select-role", { state: { temp_token: res.data.temp_token } });
      } else {
        localStorage.setItem("token", res.data.access_token);
        localStorage.setItem("role", res.data.role);
        if (res.data.role === "admin") {
          window.location.href = "/dashboard";
        } else if (res.data.role === "worker") {
          window.location.href = "/worker/dashboard";
        } else {
          window.location.href = "/employer/dashboard";
        }
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Google authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (code) {
      handleLogin(code);
    }
  }, [code]);

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <span className="auth-icon">🔄</span>
            <h1>Authenticating</h1>
            <p>Verifying Google credentials with Rozgar...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-icon">🌐</span>
          <h1>Google Authentication</h1>
          <p>Select a Google account to simulate the OAuth flow</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="auth-form" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            onClick={() => handleLogin("mock_new_user")}
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center" }}
          >
            Google: New User (new_google_user@example.com)
          </button>
          <button
            onClick={() => handleLogin("mock_existing_worker")}
            className="btn btn-secondary"
            style={{ width: "100%", justifyContent: "center" }}
          >
            Google: Existing Worker (worker@rozgar.com)
          </button>
          <button
            onClick={() => handleLogin("mock_existing_employer")}
            className="btn btn-secondary"
            style={{ width: "100%", justifyContent: "center" }}
          >
            Google: Existing Employer (employer@rozgar.com)
          </button>
          <button
            onClick={() => handleLogin("mock_existing_admin")}
            className="btn btn-secondary"
            style={{ width: "100%", justifyContent: "center" }}
          >
            Google: Existing Admin (admin@rozgar.com)
          </button>
        </div>
      </div>
    </div>
  );
}
