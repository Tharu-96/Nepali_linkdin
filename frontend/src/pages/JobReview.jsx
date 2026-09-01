import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ReviewForm from "../components/reviews/ReviewForm";
import ReviewCard from "../components/reviews/ReviewCard";
import ReviewSummary from "../components/reviews/ReviewSummary";
import { reviewsAPI, paymentsAPI, jobsAPI, applicationsAPI } from "../api";
import { continueToPaymentGateway } from "../services/paymentGateway";

/**
 * JobReview page — /jobs/:jobId/review
 *
 * Employers land here after a job is completed.
 * - Shows the form to review the accepted worker
 * - Shows the worker's review summary profile
 */
export default function JobReview() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [job, setJob] = useState(null);
  const [revieweeId, setRevieweeId] = useState(null);
  const [revieweeName, setRevieweeName] = useState("");
  const [myReviews, setMyReviews] = useState([]);  // reviews I wrote
  const [theirSummary, setTheirSummary] = useState(null);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [workerPayment, setWorkerPayment] = useState(null); // accepted worker's payment coordinates
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [selectedForm, setSelectedForm] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [paying, setPaying] = useState("");
  const [completingJob, setCompletingJob] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        if (user.role !== "employer") {
          setError("Only employers can review workers after completed work.");
          setLoading(false);
          return;
        }

        // Fetch job info
        const jobRes = await jobsAPI.getJob(jobId);
        const jobData = jobRes.data;
        setJob(jobData);

        // Determine who to review
        let targetId = null;
        let reviewAllowed = jobData.status === "completed";
        const appsRes = await jobsAPI.getJobApplications(jobId);
        setApplications(appsRes.data || []);
        const accepted = appsRes.data.find((a) => ["accepted", "completed"].includes(a.status));
        if (accepted) {
          targetId = accepted.worker_id;
          setRevieweeName(accepted.worker?.name || `Worker #${accepted.worker_id}`);
          setWorkerPayment(accepted.worker || null);
          reviewAllowed = reviewAllowed || accepted.status === "completed";
        }

        if (!reviewAllowed) {
          setError("Reviews are only available after the work is completed.");
          setLoading(false);
          return;
        }

        if (!targetId) {
          setError("Could not determine who to review for this job. Make sure a worker was accepted.");
          setLoading(false);
          return;
        }
        setRevieweeId(targetId);

        // Check if I've already reviewed for this job
        const mySubmittedRes = await reviewsAPI.getMySubmittedReviews(1, 50);
        const myJobReview = (mySubmittedRes.data?.reviews || []).find(
          (r) => r.job_id === parseInt(jobId)
        );
        if (myJobReview) {
          setAlreadyReviewed(true);
          setMyReviews([myJobReview]);
        }

        // Load only the rating summary. Showing the review cards here repeats
        // the employer's newly submitted review in the same screen.
        const summaryRes = await reviewsAPI.getReviewSummary(targetId);
        setTheirSummary(summaryRes.data);
      } catch (err) {
        setError(
          err?.response?.data?.detail ||
            "Failed to load review information."
        );
      } finally {
        setLoading(false);
      }
    };

    if (user) loadData();
  }, [jobId, user, submitted]);

  const handleReviewSuccess = (newReview) => {
    setAlreadyReviewed(true);
    setMyReviews([newReview]);
    setSubmitted(true);
    setShowForm(false);
  };

  const handleStatusUpdate = async (appId, status, workerId) => {
    setUpdatingId(appId);
    try {
      await applicationsAPI.updateStatus(appId, status);
      setApplications((prev) => prev.map((a) => (a.id === appId ? { ...a, status } : a)));
      if (status === "accepted") {
        const acceptedApp = applications.find((a) => a.id === appId) || null;
        setWorkerPayment(acceptedApp?.worker || null);
        setRevieweeName(acceptedApp?.worker?.name || `Worker #${workerId}`);
      }
    } catch (err) {
      alert(err?.response?.data?.detail || "Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };

  // Initiate a real gateway payment and redirect to the secure checkout page.
  const handlePay = async (gateway) => {
    if (job?.status !== "completed") {
      setError("Mark the work completed before starting payment.");
      return;
    }
    setError("");
    setPaying(gateway);
    try {
      const req = { job_id: parseInt(jobId), gateway };
      const res =
        gateway === "khalti"
          ? await paymentsAPI.initiateKhaltiPayment(req)
          : await paymentsAPI.initiatePayment(req);
      continueToPaymentGateway(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || `Failed to start ${gateway} payment.`);
    } finally {
      setPaying("");
    }
  };

  const handleMarkWorkCompleted = async () => {
    setError("");
    setCompletingJob(true);
    try {
      await paymentsAPI.completeJob(jobId);
      setJob((currentJob) => (currentJob ? { ...currentJob, status: "completed" } : currentJob));
      setApplications((currentApps) =>
        currentApps.map((app) => (["accepted", "completed"].includes(app.status) ? { ...app, status: "completed" } : app))
      );
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to mark the work completed.");
    } finally {
      setCompletingJob(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "4rem", color: "#6b7280" }}>
        <div
          style={{
            width: "40px",
            height: "40px",
            border: "3px solid #e5e7eb",
            borderTop: "3px solid #4f46e5",
            borderRadius: "50%",
            margin: "0 auto 1rem",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p>Loading review details…</p>
        <style>{`@keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }`}</style>
      </div>
    );
  }
    
  
  if (error) {
    return (
      <div style={{ maxWidth: "600px", margin: "3rem auto", padding: "0 1rem" }}>
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: "12px",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: "2.5rem" }}>⚠️</span>
          <p style={{ color: "#dc2626", marginTop: "0.75rem", fontWeight: 500 }}>
            {error}
          </p>
          <button
            onClick={() => navigate(-1)}
            style={{
              marginTop: "1rem",
              padding: "0.6rem 1.5rem",
              background: "#ef4444",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "800px", margin: "2rem auto", padding: "0 1rem" }}>
      {/* Page header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "none",
            border: "none",
            color: "#4f46e5",
            cursor: "pointer",
            fontSize: "0.9rem",
            padding: 0,
            marginBottom: "0.75rem",
            fontWeight: 500,
          }}
        >
          ← Back
        </button>
        <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 700 }}>
          ⭐ Review &amp; Ratings
        </h1>
        <p style={{ margin: "0.25rem 0 0", color: "#6b7280" }}>
          Job #{jobId}: {job?.title}
        </p>
      </div>

      {/* Employer: candidate payment panel + branded settlement buttons */}
      {user.role === "employer" && workerPayment && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "16px",
            padding: "1.5rem",
            marginBottom: "1.5rem",
            boxShadow: "0 4px 14px rgba(16,24,40,0.06)",
          }}
        >
          <h3 style={{ margin: "0 0 1rem", fontSize: "1.05rem", fontWeight: 700, color: "#111827" }}>
            💳 Settle Payment · {revieweeName}
          </h3>

          {job?.status !== "completed" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem", padding: "0.875rem 1rem", borderRadius: 10, border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e" }}>
              <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>Confirm that the work is finished before paying the worker.</span>
              <button
                type="button"
                onClick={handleMarkWorkCompleted}
                disabled={completingJob}
                style={{ minHeight: 40, padding: "0.55rem 0.9rem", border: "none", borderRadius: 8, background: "#d97706", color: "#fff", cursor: completingJob ? "not-allowed" : "pointer", fontWeight: 700, opacity: completingJob ? 0.7 : 1 }}
              >
                {completingJob ? "Marking completed…" : "Mark Work Completed"}
              </button>
            </div>
          )}

          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "flex-start" }}>
            {/* eSewa coordinates */}
            <div style={{ minWidth: 200 }}>
              <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: 700, color: "#60bb46", textTransform: "uppercase", letterSpacing: "0.04em" }}>eSewa</p>
              <p style={{ margin: "0.35rem 0", color: "#374151", fontSize: "0.95rem" }}>
                📱 {workerPayment.esewa_number || "Not provided"}
              </p>
            </div>

            {/* Khalti coordinates */}
            <div style={{ minWidth: 200 }}>
              <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: 700, color: "#5c2d91", textTransform: "uppercase", letterSpacing: "0.04em" }}>Khalti</p>
              <p style={{ margin: "0.35rem 0", color: "#374151", fontSize: "0.95rem" }}>
                📱 {workerPayment.khalti_number || "Not provided"}
              </p>
            </div>
          </div>

          {/* Branded gateway choice points */}
          {job?.status === "completed" && (
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={!!paying || !workerPayment.esewa_number}
              onClick={() => handlePay("esewa")}
              className="bg-[#60bb46] text-white hover:bg-[#52a23b] font-semibold rounded-xl px-4 py-2.5 transition-all shadow-sm"
              style={{ flex: "1 1 190px", minHeight: 44, background: "#60bb46", color: "#fff", fontWeight: 600, borderRadius: 12, padding: "0.625rem 1rem", border: "none", cursor: workerPayment.esewa_number ? "pointer" : "not-allowed", opacity: !workerPayment.esewa_number ? 0.5 : 1, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}
            >
              {paying === "esewa" ? "Redirecting…" : "Pay with eSewa"}
            </button>
            <button
              type="button"
              disabled={!!paying || !workerPayment.khalti_number}
              onClick={() => handlePay("khalti")}
              className="bg-[#5c2d91] text-white hover:bg-[#4c2479] font-semibold rounded-xl px-4 py-2.5 transition-all shadow-sm"
              style={{ flex: "1 1 190px", minHeight: 44, background: "#5c2d91", color: "#fff", fontWeight: 600, borderRadius: 12, padding: "0.625rem 1rem", border: "none", cursor: workerPayment.khalti_number ? "pointer" : "not-allowed", opacity: !workerPayment.khalti_number ? 0.5 : 1, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}
            >
              {paying === "khalti" ? "Redirecting…" : "Pay with Khalti"}
            </button>
          </div>
          )}
        </div>
      )}

      {/* Employer: applicants list + ability to view individual application payload */}
      {user.role === "employer" && applications.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: "1.25rem" }}>
          <h4 style={{ margin: 0, marginBottom: 12, fontSize: "0.95rem", fontWeight: 700 }}>Applicants</h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: '#6b7280', fontSize: 13 }}>
                  <th style={{ padding: '12px 14px' }}>ID</th>
                  <th style={{ padding: '12px 14px' }}>Worker</th>
                  <th style={{ padding: '12px 14px' }}>Status</th>
                  <th style={{ padding: '12px 14px' }}>Applied</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id} style={{ borderTop: '1px solid #f3f4f6', textAlign: 'center' }}>
                    <td style={{ padding: '14px', verticalAlign: 'middle' }}>#{app.id}</td>
                    <td style={{ padding: '14px', verticalAlign: 'middle' }}>{app.worker ? `${app.worker.name} (${app.worker.email})` : `Worker #${app.worker_id}`}</td>
                    <td style={{ padding: '14px', verticalAlign: 'middle' }}>
                      <span style={{ padding: '6px 8px', borderRadius: 8, background: app.status === 'accepted' ? '#dcfce7' : app.status === 'rejected' ? '#fee2e2' : '#fff7ed', color: app.status === 'accepted' ? '#166534' : app.status === 'rejected' ? '#991b1b' : '#92400e', fontWeight: 600, fontSize: 13 }}>{app.status}</span>
                    </td>
                    <td style={{ padding: '14px', verticalAlign: 'middle' }}>{new Date(app.applied_at).toLocaleDateString()}</td>
                    <td style={{ padding: '14px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 8, justifyContent: 'center', alignItems: 'center', minWidth: 250 }}>
                        {app.status === 'pending' && (
                          <>
                            <button className="btn btn-sm btn-success" onClick={() => handleStatusUpdate(app.id, 'accepted', app.worker_id)} disabled={updatingId === app.id}>Accept</button>
                            <button className="btn btn-sm btn-danger" onClick={() => handleStatusUpdate(app.id, 'rejected', app.worker_id)} disabled={updatingId === app.id}>Reject</button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => setSelectedForm(app)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-1 px-3 rounded shadow transition-all"
                        >
                          View
                        </button>

                        <button 
                          onClick={() => setSelectedApp(app)}
                          className="text-center text-xs text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 font-semibold py-1.5 px-2 rounded-md border border-indigo-200 transition-all"
                        >
                          📄 View Form
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))",
          gap: "1.5rem",
        }}
      >
        {/* LEFT: Submit your review */}
        <div>
          <h3
            style={{
              margin: "0 0 1rem",
              fontSize: "1rem",
              fontWeight: 700,
              color: "#374151",
            }}
          >
            Your Review for {revieweeName}
          </h3>

          {alreadyReviewed ? (
            <div>
              {submitted && (
                <div
                  style={{
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: "12px",
                    padding: "1rem 1.25rem",
                    marginBottom: "1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    color: "#16a34a",
                    fontWeight: 500,
                  }}
                >
                  ✅ Review submitted successfully!
                </div>
              )}
              {myReviews.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
          ) : showForm ? (
            <ReviewForm
              jobId={parseInt(jobId)}
              revieweeId={revieweeId}
              reviewerRole="employer"
              onSuccess={handleReviewSuccess}
              onCancel={() => setShowForm(false)}
            />
          ) : (
            <div
              style={{
                background: "#f9fafb",
                border: "1px dashed #d1d5db",
                borderRadius: "12px",
                padding: "2rem",
                textAlign: "center",
              }}
            >
              <span style={{ fontSize: "2.5rem" }}>✍️</span>
              <p
                style={{
                  margin: "0.75rem 0",
                  fontWeight: 500,
                  color: "#374151",
                }}
              >
                You haven't reviewed {revieweeName} yet.
              </p>
              <p
                style={{
                  margin: "0 0 1.25rem",
                  fontSize: "0.875rem",
                  color: "#6b7280",
                }}
              >
                Share your experience to help others make informed decisions.
              </p>
              <button
                onClick={() => setShowForm(true)}
                style={{
                  padding: "0.75rem 2rem",
                  background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                }}
              >
                Write a Review
              </button>
            </div>
          )}
        </div>

        {/* RIGHT: Their rating summary */}
        <div>
          <h3
            style={{
              margin: "0 0 1rem",
              fontSize: "1rem",
              fontWeight: 700,
              color: "#374151",
            }}
          >
            {revieweeName}'s Rating Profile
          </h3>
          <ReviewSummary
            summary={theirSummary}
            userRole={user.role === "employer" ? "worker" : "employer"}
          />
        </div>
      </div>

      {/* READ-ONLY APPLICATION VIEWER (selectedForm) */}
      {selectedForm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
          onClick={() => setSelectedForm(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(920px, 96%)', maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 12px 40px rgba(2,6,23,0.2)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Application Details — Read Only</h3>
              <button onClick={() => setSelectedForm(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 800 }}>Personal & Professional Background</p>
                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>Full Name</div>
                    <input readOnly value={selectedForm.worker_name || selectedForm.worker?.name || selectedForm.full_name || ''} style={{ marginTop: 6, color: '#111827', fontWeight: 600, width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>Email</div>
                    <input readOnly value={selectedForm.worker_email || selectedForm.worker?.email || selectedForm.email || ''} style={{ marginTop: 6, color: '#111827', width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb' }} />
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>Professional Headline</div>
                  <input readOnly value={selectedForm.professional_headline || selectedForm.worker?.professional_headline || ''} style={{ marginTop: 6, color: '#374151', width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fafafc' }} />
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>Skills (comma separated)</div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff' }}>
                    {((selectedForm.skills || (selectedForm.worker && selectedForm.worker.skills) || '')
                      .toString()
                      .split(',')
                      .filter(Boolean)
                      .map((s, i) => (
                        <span key={i} style={{ background: '#f3f4f6', padding: '6px 8px', borderRadius: 8, fontSize: 13 }}>{s.trim()}</span>
                      )))}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontWeight: 800 }}>Job Proposal Pitch</p>
                <textarea readOnly value={selectedForm.proposal_pitch || selectedForm.worker?.proposal_pitch || 'No proposal provided.'} rows={8} style={{ marginTop: 8, border: '1px solid #e5e7eb', padding: 12, borderRadius: 8, background: '#fafafc', color: '#374151', width: '100%', resize: 'vertical' }} />

                <div style={{ height: 12 }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>eSewa ID Number</div>
                    <input readOnly value={selectedForm.esewa_number || selectedForm.worker?.esewa_number || ''} style={{ marginTop: 6, width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff' }} />
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>Khalti ID Number</div>
                    <input readOnly value={selectedForm.khalti_number || selectedForm.worker?.khalti_number || ''} style={{ marginTop: 6, width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff' }} />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button onClick={() => setSelectedForm(null)} style={{ padding: '8px 12px', borderRadius: 8, background: '#fff', border: '1px solid #e5e7eb', cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: THIS IS EXACTLY WHERE THE MODAL CODES BELONGS NOW */}
      {selectedApp && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setSelectedApp(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(920px, 96%)', maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 12px 40px rgba(2,6,23,0.2)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Submitted Application — Read Only</h3>
              <button onClick={() => setSelectedApp(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
              <div>
                <div style={{ marginBottom: 12 }}>
                  <p style={{ margin: 0, fontWeight: 800 }}>Personal & Professional Background</p>
                  <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>Full name</div>
                      <div style={{ marginTop: 6, color: '#111827', fontWeight: 600 }}>{selectedApp.worker?.name || selectedApp.full_name || selectedApp.worker?.full_name || ''}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>Email</div>
                      <div style={{ marginTop: 6, color: '#111827' }}>{selectedApp.worker?.email || selectedApp.email || ''}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>Professional Headline</div>
                    <div style={{ marginTop: 6, color: '#374151' }}>{selectedApp.worker?.professional_headline || selectedApp.professional_headline || ''}</div>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 700 }}>Skills</div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {(((selectedApp.worker && selectedApp.worker.skills) || selectedApp.skills) || '')
                        .toString()
                        .split(',')
                        .filter(Boolean)
                        .map((s, i) => (
                          <span key={i} style={{ background: '#f3f4f6', padding: '6px 8px', borderRadius: 8, fontSize: 13 }}>{s.trim()}</span>
                        ))}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 6 }}>
                  <p style={{ margin: 0, fontWeight: 800 }}>Job Proposal Pitch</p>
                  <div style={{ marginTop: 8, border: '1px solid #e5e7eb', padding: 12, borderRadius: 8, background: '#fafafc', color: '#374151', whiteSpace: 'pre-wrap' }}>
                    {selectedApp.proposal_pitch || selectedApp.worker?.proposal_pitch || 'No proposal provided.'}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontWeight: 800 }}>Payment Verification Setup</p>
                <p style={{ margin: '8px 0', color: '#374151' }}>eSewa: {selectedApp.worker?.esewa_number || selectedApp.esewa_number || '—'}</p>
                <div style={{ height: 12 }} />
                <p style={{ margin: 0, fontWeight: 800 }}>Khalti: {selectedApp.worker?.khalti_number || selectedApp.khalti_number || '—'}</p>
              </div>
            </div>

            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button onClick={() => setSelectedApp(null)} style={{ padding: '8px 12px', borderRadius: 8, background: '#fff', border: '1px solid #e5e7eb', cursor: 'pointer' }}>Close Viewer</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
