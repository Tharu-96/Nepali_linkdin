import { useState } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { authAPI } from "../../api";
import { UserCircle, Briefcase, Building } from "lucide-react";

export default function SelectRole() {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const temp_token = location.state?.temp_token;

  if (!temp_token) {
    return <Navigate to="/login" replace />;
  }

  const handleRoleSelection = async (role) => {
    setLoading(true);
    setError("");
    try {
      const res = await authAPI.googleCompleteRegistration({
        temp_token,
        role,
      });
      localStorage.setItem("token", res.data.access_token);
      localStorage.setItem("role", res.data.role);
      
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err.response?.data?.detail || "Registration completion failed.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-lg w-full space-y-8 bg-white p-10 rounded-2xl shadow-card border border-slate-100">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-primary-100 text-primary-600 rounded-xl flex items-center justify-center mb-4">
            <UserCircle size={28} />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Choose Your Role</h2>
          <p className="mt-2 text-sm text-slate-600">To complete your registration, please select how you plan to use Rozgar</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm font-medium">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4 mt-8">
          <button
            onClick={() => handleRoleSelection("worker")}
            disabled={loading}
            className="flex flex-col items-center p-6 border-2 border-slate-200 rounded-2xl hover:border-primary-500 hover:bg-primary-50 transition-colors disabled:opacity-50"
          >
            <Briefcase size={36} className="text-primary-600 mb-3" />
            <span className="font-bold text-xl text-slate-900 mb-2">I am a Worker</span>
            <span className="text-sm text-slate-500 text-center">
              Find jobs, apply to positions, and manage my job applications.
            </span>
          </button>

          <button
            onClick={() => handleRoleSelection("employer")}
            disabled={loading}
            className="flex flex-col items-center p-6 border-2 border-slate-200 rounded-2xl hover:border-primary-500 hover:bg-primary-50 transition-colors disabled:opacity-50"
          >
            <Building size={36} className="text-primary-600 mb-3" />
            <span className="font-bold text-xl text-slate-900 mb-2">I am an Employer</span>
            <span className="text-sm text-slate-500 text-center">
              Post jobs, hire workers, and manage my organization profiles.
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
