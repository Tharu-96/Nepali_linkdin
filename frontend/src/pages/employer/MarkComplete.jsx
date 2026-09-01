import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { jobsAPI, paymentsAPI } from '../../api';
import ReviewForm from '../../components/reviews/ReviewForm';

export default function MarkComplete() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState(null);
  const [revieweeId, setRevieweeId] = useState(null);
  const [revieweeName, setRevieweeName] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const [jobRes, appsRes] = await Promise.all([
          jobsAPI.getJob(jobId),
          jobsAPI.getJobApplications(jobId),
        ]);

        const jobData = jobRes.data;
        setJob(jobData);

        const accepted = (appsRes.data || []).find((app) =>
          ['accepted', 'completed'].includes(app.status)
        );
        if (accepted) {
          setRevieweeId(accepted.worker_id);
          setRevieweeName(accepted.worker?.name || `Worker #${accepted.worker_id}`);
        }
      } catch (err) {
        alert('Job not found');
        navigate('/');
      }
    };
    fetchJob();
  }, [jobId, navigate]);

  const handleComplete = async () => {
    setLoading(true);
    try {
      await paymentsAPI.completeJob(jobId);
      setShowReviewModal(true);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to complete job');
    } finally {
      setLoading(false);
    }
  };

  if (!job) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <>
      <div style={{ maxWidth: '600px', margin: '40px auto', padding: '24px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <h2 style={{ color: '#111827', marginTop: 0 }}>Mark Job as Complete</h2>
        <p style={{ color: '#4b5563', lineHeight: '1.6' }}>
          You are about to mark the job <strong>{job.title}</strong> as complete.
          After completion, a review popup will open so you can rate the worker before payment.
        </p>

        <div style={{ backgroundColor: '#fef3c7', padding: '16px', borderRadius: '8px', color: '#92400e', marginBottom: '24px' }}>
          <strong>Important:</strong> Please ensure the worker has finished all tasks satisfactorily before proceeding.
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => navigate(-1)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 500 }}>
            Cancel
          </button>
          <button onClick={handleComplete} disabled={loading} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#4f46e5', color: '#fff', cursor: 'pointer', fontWeight: 500, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Processing...' : 'Mark Complete & Review Worker'}
          </button>
        </div>
      </div>

      {showReviewModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(17,24,39,0.6)',
            padding: 20,
          }}
        >
          <div
            style={{
              width: 'min(92vw, 760px)',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#fff',
              borderRadius: 20,
              boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111827' }}>Rate and Review Worker</h3>
                <p style={{ margin: '6px 0 0', color: '#6b7280' }}>
                  Submit feedback for {revieweeName || 'the worker'} before payment.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                style={{
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  borderRadius: 10,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Close
              </button>
            </div>

            {revieweeId ? (
              <ReviewForm
                jobId={parseInt(jobId, 10)}
                revieweeId={revieweeId}
                reviewerRole="employer"
                onSuccess={() => {
                  setShowReviewModal(false);
                  navigate(`/payment/pay/${jobId}`);
                }}
                onCancel={() => {
                  setShowReviewModal(false);
                  navigate(`/payment/pay/${jobId}`);
                }}
              />
            ) : (
              <div style={{ padding: 20, border: '1px solid #e5e7eb', borderRadius: 12 }}>
                <p style={{ margin: 0, color: '#374151' }}>No accepted worker was found for this job yet.</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={() => navigate(`/payment/pay/${jobId}`)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 10,
                      border: 'none',
                      background: '#111827',
                      color: '#fff',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Continue to Payment
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
