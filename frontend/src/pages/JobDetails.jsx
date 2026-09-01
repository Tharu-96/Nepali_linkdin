import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Briefcase, MapPin, WalletCards } from "lucide-react";
import { jobsAPI } from "../api";
import { useAuth } from "../context/AuthContext";

export default function JobDetails() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadJob = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await jobsAPI.getJob(jobId);
        setJob(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to load job details");
      } finally {
        setLoading(false);
      }
    };

    loadJob();
  }, [jobId]);

  if (loading) {
    return (
      <div className="page-loader">
        <div className="spinner" />
        <p>Loading job details...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="page-container">
        <button className="btn btn-outline btn-sm mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="alert alert-error">{error || "Job not found"}</div>
      </div>
    );
  }

  const isOwner = role === "employer" && String(job.employer_id) === String(user?.id);
  const statusLabel = !job.status || job.status === "open" || job.status === "pending_approval"
    ? "Live"
    : job.status.replace(/_/g, " ");

  return (
    <div className="page-container">
      <button className="btn btn-outline btn-sm mb-5" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </button>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {job.is_urgent && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700">
                  <AlertCircle size={14} /> Urgent
                </span>
              )}
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                {statusLabel}
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{job.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{job.description}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {isOwner && (
              <Link to={`/jobs/${job.id}/applications`} className="btn btn-primary">
                View Applications
              </Link>
            )}
            {role === "worker" && (
              <Link to="/jobs" className="btn btn-primary">
                Apply from Jobs
              </Link>
            )}
          </div>
        </div>

        <div className="grid gap-4 pt-6 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <MapPin size={18} /> Location
            </div>
            <p className="text-sm text-slate-600">{job.location}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <WalletCards size={18} /> Estimated Salary
            </div>
            <p className="text-sm text-slate-600">{job.salary}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Briefcase size={18} /> Posted
            </div>
            <p className="text-sm text-slate-600">
              {job.created_at ? new Date(job.created_at).toLocaleDateString() : "Not available"}
            </p>
          </div>
        </div>

        {job.required_skills && (
          <div className="pt-6">
            <h2 className="mb-3 text-base font-bold text-slate-900">Required Skills</h2>
            <div className="flex flex-wrap gap-2">
              {job.required_skills.split(",").map((skill) => (
                <span key={skill} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600">
                  {skill.trim()}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
