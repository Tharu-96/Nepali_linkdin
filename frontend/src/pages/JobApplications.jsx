import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { applicationsAPI, jobsAPI, paymentsAPI } from "../api";
import PaginationControls from "../components/admin/PaginationControls";
import ReviewForm from "../components/reviews/ReviewForm";

const APPLICATION_STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-800",
  accepted: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
  completed: "bg-slate-200 text-slate-700",
};

export default function JobApplications() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [page, setPage] = useState(1);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewTargetApp, setReviewTargetApp] = useState(null);
  const pageSize = 10;

  useEffect(() => {
    const load = async () => {
      try {
        const [jobRes, appsRes] = await Promise.all([
          jobsAPI.getJob(jobId),
          jobsAPI.getJobApplications(jobId),
        ]);
        setJob(jobRes.data);
        setApplications(appsRes.data || []);
      } catch (err) {
        console.log("Backend Error:", err.response?.data);
        setError(err.response?.data?.detail || "Failed to load applications");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [jobId]);

  const handleStatusUpdate = async (appId, status, workerId) => {
    setUpdatingId(appId);
    setSuccessMsg("");
    try {
      await applicationsAPI.updateStatus(appId, status);
      setApplications((prev) =>
        prev.map((app) => (app.id === appId ? { ...app, status } : app))
      );

      if (status === "accepted") {
        setSuccessMsg("Application accepted. A chat has been opened with the worker.");
        const openChat = window.confirm(
          "Application accepted. A chat channel has been opened automatically.\n\nOpen chat now?"
        );
        if (openChat) {
          navigate(`/chat?userId=${workerId}`);
        }
      }
    } catch (err) {
      console.log("Backend Error:", err.response?.data);
      alert(err.response?.data?.detail || "Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMarkComplete = async (app) => {
    setUpdatingId(app.id);
    setSuccessMsg("");
    try {
      // Completion is a job-level lifecycle event. This endpoint updates both
      // the selected application and the job to completed, and notifies the
      // worker that payment is next.
      await paymentsAPI.completeJob(jobId);
      const updatedApp = { ...app, status: "completed" };
      setApplications((prev) =>
        prev.map((item) => (item.id === app.id ? updatedApp : item))
      );
      setJob((currentJob) => currentJob ? { ...currentJob, status: "completed" } : currentJob);
      setReviewTargetApp(updatedApp);
      setShowReviewModal(true);
      setSuccessMsg(`Application completed for ${app.worker?.name || `Worker #${app.worker_id}`}.`);
    } catch (err) {
      console.log("Backend Error:", err.response?.data);
      alert(err.response?.data?.detail || "Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };

  const stats = useMemo(() => {
    const pending = applications.filter((app) => app.status === "pending").length;
    const accepted = applications.filter((app) => app.status === "accepted").length;
    const rejected = applications.filter((app) => app.status === "rejected").length;
    const completed = applications.filter((app) => app.status === "completed").length;
    return { pending, accepted, rejected, completed };
  }, [applications]);

  const paginatedApplications = useMemo(() => {
    const start = (page - 1) * pageSize;
    return applications.slice(start, start + pageSize);
  }, [applications, page]);

  const totalPages = Math.max(1, Math.ceil(applications.length / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-primary-600" />
        <p className="mt-4 text-sm font-medium text-slate-600">Loading applications...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.08),_transparent_40%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <button
          className="mb-4 inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-primary-300 hover:text-primary-700"
          onClick={() => navigate(-1)}
        >
          Back
        </button>

        {error && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
        {successMsg && <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{successMsg}</div>}

        {job && (
          <section className="mb-6 rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-600">Applications</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{job.title}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{job.description}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Location</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{job.location}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated Salary</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{job.salary}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Posted</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {job.created_at ? new Date(job.created_at).toLocaleDateString() : "Not available"}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Job Status</p>
                  <p className="mt-1 text-sm font-semibold capitalize text-slate-800">{job.status || "open"}</p>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Total Applications</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{applications.length}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-amber-700">Pending</p>
            <p className="mt-2 text-3xl font-bold text-amber-900">{stats.pending}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-emerald-700">Accepted</p>
            <p className="mt-2 text-3xl font-bold text-emerald-900">{stats.accepted}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-rose-700">Rejected</p>
            <p className="mt-2 text-3xl font-bold text-rose-900">{stats.rejected}</p>
          </div>
        </section>

        {applications.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-800">No applications yet for this job.</p>
            <p className="mt-2 text-sm text-slate-500">Workers who apply to this posting will appear here.</p>
          </div>
        ) : (
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-lg font-bold text-slate-900">Worker Applications</h2>
              <p className="mt-1 text-sm text-slate-500">Review each applicant and decide who should move forward.</p>
            </div>

            <div className="hidden md:block">
              <table className="w-full border-collapse">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Application</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Worker</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Applied</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedApplications.map((app) => (
                    <tr key={app.id} className="border-t border-slate-100 align-top">
                      <td className="px-6 py-5">
                        <p className="font-semibold text-slate-900">ID : {app.id}</p>
                        <p className="mt-1 text-sm text-slate-500">{job?.title || app.job?.title || "Job title not available"}</p>
                      </td>
                      <td className="px-6 py-5">
                        <p className="font-semibold text-slate-900">
                          {app.worker ? app.worker.name : `Worker #${app.worker_id}`}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {app.worker?.email || "Email not available"}
                        </p>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${APPLICATION_STATUS_STYLES[app.status] || "bg-slate-100 text-slate-700"}`}>
                          {app.status}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-600">
                        {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : "Not available"}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex min-w-[150px] flex-wrap gap-2">
                          {app.status === "pending" && (
                            <>
                              <button
                                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() => handleStatusUpdate(app.id, "accepted", app.worker_id)}
                                disabled={updatingId === app.id}
                              >
                                {updatingId === app.id ? "Updating..." : "Accept"}
                              </button>
                              <button
                                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() => handleStatusUpdate(app.id, "rejected", app.worker_id)}
                                disabled={updatingId === app.id}
                              >
                                {updatingId === app.id ? "Updating..." : "Reject"}
                              </button>
                            </>
                          )}

                          {app.status === "accepted" && (
                            <>
                              <button
                                className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700 transition hover:bg-primary-100"
                                onClick={() => navigate(`/chat?userId=${app.worker_id}`)}
                              >
                                Chat
                              </button>
                              <button
                                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() => handleMarkComplete(app)}
                                disabled={updatingId === app.id}
                              >
                                {updatingId === app.id ? "Updating..." : "Mark Complete"}
                              </button>
                            </>
                          )}

                          {app.status === "completed" && (
                            <>
                              <button
                                className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700 transition hover:bg-primary-100"
                                onClick={() => navigate(`/chat?userId=${app.worker_id}`)}
                              >
                                Chat
                              </button>
                              <button
                                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                                onClick={() => {
                                  setReviewTargetApp(app);
                                  setShowReviewModal(true);
                                }}
                              >
                                Review Worker
                              </button>
                              <button
                                className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
                                onClick={() => navigate(`/jobs/${jobId}/review`)}
                              >
                                Review & Payment
                              </button>
                              </>
                          )}

                          {app.status === "rejected" && (
                            <span className="inline-flex items-center rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-500">
                              No actions
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls
              page={page}
              totalPages={totalPages}
              totalItems={applications.length}
              pageSize={paginatedApplications.length}
              onPageChange={setPage}
            />

            <div className="grid gap-4 p-4 md:hidden">
              {paginatedApplications.map((app) => (
                <article key={app.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">Application #{app.id}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {app.worker ? `${app.worker.name} (${app.worker.email})` : `Worker #${app.worker_id}`}
                      </p>
                    </div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${APPLICATION_STATUS_STYLES[app.status] || "bg-slate-100 text-slate-700"}`}>
                      {app.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-500">
                    Applied: {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : "Not available"}
                  </p>
                  <div className="mt-4 flex min-w-[150px] flex-wrap gap-2">
                    {app.status === "pending" && (
                      <>
                        <button
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                          onClick={() => handleStatusUpdate(app.id, "accepted", app.worker_id)}
                          disabled={updatingId === app.id}
                        >
                          {updatingId === app.id ? "Updating..." : "Accept"}
                        </button>
                        <button
                          className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
                          onClick={() => handleStatusUpdate(app.id, "rejected", app.worker_id)}
                          disabled={updatingId === app.id}
                        >
                          {updatingId === app.id ? "Updating..." : "Reject"}
                        </button>
                      </>
                    )}

                    {app.status === "accepted" && (
                      <>
                        <button
                          className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700"
                          onClick={() => navigate(`/chat?userId=${app.worker_id}`)}
                        >
                          Chat
                        </button>
                        <button
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                          onClick={() => handleMarkComplete(app)}
                          disabled={updatingId === app.id}
                        >
                          {updatingId === app.id ? "Updating..." : "Mark Complete"}
                        </button>
                      </>
                    )}

                    {app.status === "completed" && (
                      <>
                        <button
                          className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700"
                          onClick={() => navigate(`/chat?userId=${app.worker_id}`)}
                        >
                          Chat
                        </button>
                        <button
                          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                          onClick={() => {
                            setReviewTargetApp(app);
                            setShowReviewModal(true);
                          }}
                        >
                          Review Worker
                        </button>
                        <button
                          className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white"
                          onClick={() => navigate(`/jobs/${jobId}/review`)}
                        >
                          Review & Payment
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {showReviewModal && reviewTargetApp && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 sm:items-center sm:p-6">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="review-worker-title"
              className="my-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)]"
            >
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 p-4 sm:p-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary-600">Review Worker</p>
                  <h2 id="review-worker-title" className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">
                    Rate {reviewTargetApp.worker?.name || `Worker #${reviewTargetApp.worker_id}`}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">Submit the review now that the job is completed.</p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                  onClick={() => setShowReviewModal(false)}
                >
                  Close
                </button>
              </div>
              <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
                <ReviewForm
                  jobId={parseInt(jobId, 10)}
                  revieweeId={reviewTargetApp.worker_id}
                  reviewerRole="employer"
                  onSuccess={(newReview) => {
                    setSuccessMsg(`Review submitted for ${reviewTargetApp.worker?.name || `Worker #${reviewTargetApp.worker_id}`}.`);
                    setShowReviewModal(false);
                    setReviewTargetApp(null);
                  }}
                  onCancel={() => {
                    setShowReviewModal(false);
                    setReviewTargetApp(null);
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
