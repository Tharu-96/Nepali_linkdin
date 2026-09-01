import React, { useEffect, useState } from "react";
import { adminAPI } from "../../api";
import ReviewCard from "../../components/reviews/ReviewCard";

export default function Reviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const res = await adminAPI.getReviews();
        setReviews(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, []);

  const deleteReview = async (review) => {
    if (!window.confirm(`Delete the review for ${review.job_title || `Job #${review.job_id}`}? It will be hidden from the platform.`)) return;

    setError("");
    setDeletingId(review.id);
    try {
      await adminAPI.deleteReview(review.id);
      setReviews((current) => current.filter((item) => item.id !== review.id));
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not delete the review.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <div style={{ padding: 20 }}>Loading Reviews...</div>;
  }

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ margin: 0 }}>Worker Ratings & Reviews</h2>
        <p style={{ marginTop: 8, color: "#6b7280" }}>
          Employers can rate completed work here. Admin can inspect every submitted review.
        </p>
      </div>

      {error && (
        <div style={{ marginBottom: "16px", padding: "12px 14px", borderRadius: "8px", color: "#991b1b", background: "#fee2e2", border: "1px solid #fca5a5" }}>
          {error}
        </div>
      )}

      {reviews.length === 0 ? (
        <div style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px dashed #d1d5db", padding: "32px", textAlign: "center", color: "#6b7280" }}>
          No reviews have been submitted yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {reviews.map((review) => (
            <div key={review.id} style={{ backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "16px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "14px", color: "#475569", fontSize: "14px" }}>
                <span><strong>Job:</strong> {review.job_title || `Job #${review.job_id}`}</span>
                <span><strong>Reviewer:</strong> {review.reviewer_name || `User #${review.reviewer_id}`}</span>
                <span><strong>Reviewee:</strong> {review.reviewee_name || `User #${review.reviewee_id}`}</span>
                <span><strong>Role:</strong> {review.reviewer_role}</span>
                <button
                  type="button"
                  onClick={() => deleteReview(review)}
                  disabled={deletingId === review.id}
                  style={{ marginLeft: "auto", padding: "5px 9px", borderRadius: "6px", border: "1px solid #fecaca", color: "#be123c", background: "#fff1f2", cursor: deletingId === review.id ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: 600, opacity: deletingId === review.id ? 0.65 : 1 }}
                >
                  {deletingId === review.id ? "Deleting..." : "Delete Review"}
                </button>
              </div>
              <ReviewCard review={review} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
