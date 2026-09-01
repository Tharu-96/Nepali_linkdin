import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Briefcase, CalendarDays, MapPin, Wallet } from "lucide-react";
import { jobsAPI } from "../../api";

export default function EmployerPlatformJobs() {
  const [tab, setTab] = useState("all");
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadJobs = async () => {
      setLoading(true);
      setError("");
      try {
        const res = tab === "emergency" ? await jobsAPI.getEmergencyJobs() : await jobsAPI.getJobs();
        setJobs(res.data || []);
      } catch (err) {
        setError(err.response?.data?.detail || err.message || "Failed to load jobs");
      } finally {
        setLoading(false);
      }
    };

    loadJobs();
  }, [tab]);

  return (
    <div className="page-container">
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Job Listings</h1>
          <p className="mt-2 text-lg text-slate-600">
            Browse platform jobs and quickly review urgent hiring needs.
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setTab("all")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === "all" ? "bg-primary-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Briefcase size={16} />
            All Jobs
          </button>
          <button
            type="button"
            onClick={() => setTab("emergency")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === "emergency" ? "bg-red-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <AlertTriangle size={16} />
            Emergency
          </button>
        </div>
      </div>

      {loading ? (
        <div className="page-loader">
          <div className="spinner" />
          <p className="text-slate-600 font-medium">Loading jobs...</p>
        </div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center shadow-card">
          <p className="text-slate-600">{tab === "emergency" ? "No emergency jobs found." : "No jobs found."}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {jobs.map((job) => (
            <article
              key={job.id}
              className={`flex min-h-[240px] flex-col rounded-2xl border bg-white p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                job.is_urgent ? "border-red-200" : "border-slate-100"
              }`}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="line-clamp-2 text-lg font-bold text-slate-900">{job.title || "Untitled job"}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {job.category || job.job_type || "General work"}
                  </p>
                </div>
                {job.is_urgent && (
                  <span className="shrink-0 rounded-full bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-red-600">
                    Urgent
                  </span>
                )}
              </div>

              <p className="line-clamp-3 flex-1 text-sm leading-6 text-slate-600">
                {job.description || "No description provided."}
              </p>

              <div className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="shrink-0 text-slate-400" />
                  <span className="truncate">{job.location || "Location not specified"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Wallet size={16} className="shrink-0 text-slate-400" />
                  <span className="truncate">{job.salary || job.budget || "Estimated salary not specified"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays size={16} className="shrink-0 text-slate-400" />
                  <span>{job.created_at ? new Date(job.created_at).toLocaleDateString() : "Date not available"}</span>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                {job.distance != null ? (
                  <span className="text-xs font-semibold text-slate-500">
                    {Number(job.distance).toFixed(1)} km away
                  </span>
                ) : (
                  <span />
                )}
                <Link
                  to={`/jobs/${job.id}`}
                  className="inline-flex items-center justify-center rounded-lg bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-100"
                >
                  View details
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
