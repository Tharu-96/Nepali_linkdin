import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { jobsAPI } from "../../api";

function getEmployerJobStatusMeta(status) {
  if (status === "open") {
    return {
      label: "Live",
      className: "bg-emerald-100 text-emerald-700",
      helper: "Your job is live on the platform.",
    };
  }

  if (status === "pending_approval") {
    return {
      label: "Live",
      className: "bg-emerald-100 text-emerald-700",
      helper: "Your job is live on the platform.",
    };
  }

  if (status === "in_progress") {
    return {
      label: "In Progress",
      className: "bg-sky-100 text-sky-700",
      helper: "A worker is currently engaged on this job.",
    };
  }

  if (status === "completed") {
    return {
      label: "Completed",
      className: "bg-slate-200 text-slate-700",
      helper: "The work is completed.",
    };
  }

  if (status === "paid") {
    return {
      label: "Paid",
      className: "bg-violet-100 text-violet-700",
      helper: "Payment has been released for this job.",
    };
  }

  return {
    label: status || "Unknown",
    className: "bg-slate-100 text-slate-700",
    helper: "",
  };
}

export default function EmployerJobs() {
  const { user } = useAuth();
  const location = useLocation();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const tab = new URLSearchParams(location.search).get("tab");

  useEffect(() => {
    const loadJobs = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await jobsAPI.getJobs();
        const employerJobs = (res.data || []).filter((job) => String(job.employer_id) === String(user?.id));
        setJobs(employerJobs);
      } catch (err) {
        setError(err.message || "Failed to load your posted jobs");
      } finally {
        setLoading(false);
      }
    };

    loadJobs();
  }, [user?.id]);

  if (tab === "applications") {
    return <Navigate to="/reviews" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Posted Jobs</h1>
            <p className="mt-2 text-lg text-slate-600">Manage the jobs you have posted on the platform</p>
          </div>
          <Link
            to="/jobs/post"
            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Post a New Job
          </Link>
        </div>

        {loading ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
            <p className="text-slate-600">Loading your jobs...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
            {error}
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
            <p className="text-lg font-medium text-slate-700">You have not posted any jobs yet.</p>
            <p className="mt-2 max-w-md text-sm text-slate-500">Create your first job posting to start receiving applications from qualified workers.</p>
            <Link to="/jobs/post" className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">
              Post Your First Job
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {jobs.map((job) => {
              const statusMeta = getEmployerJobStatusMeta(job.status);

              return (
                <div
                  key={job.id}
                  className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md ${job.is_urgent ? "ring-2 ring-rose-200" : ""}`}
                >
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    {job.is_urgent && (
                      <span className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700">
                        Urgent
                      </span>
                    )}
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusMeta.className}`}>
                      {statusMeta.label}
                    </span>
                  </div>

                  <h3 className="text-xl font-semibold text-slate-900">{job.title}</h3>
                  {statusMeta.helper && (
                    <p className="mt-2 text-sm font-medium text-slate-500">{statusMeta.helper}</p>
                  )}

                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {job.description?.substring(0, 140)}{job.description?.length > 140 ? "..." : ""}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-600">
                    <span className="rounded-full bg-slate-100 px-3 py-1">Location: {job.location}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1">Estimated Salary: {job.salary}</span>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm text-slate-500">
                      {job.created_at ? new Date(job.created_at).toLocaleDateString() : ""}
                    </span>
                    <Link
                      to={`/jobs/${job.id}/applications`}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
                    >
                      View Applications
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
