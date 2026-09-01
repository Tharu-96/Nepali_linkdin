import React, { useState } from "react";
import StarRating from "./StarRating";
import CategoryRating from "./CategoryRating";
import { reviewsAPI } from "../../api";

export default function ReviewForm({
  jobId,
  revieweeId,
  reviewerRole,
  onSuccess,
  onCancel,
  compact = false,
}) {
  const isEmployer = reviewerRole === "employer";

  const [overallRating, setOverallRating] = useState(0);
  const [categories, setCategories] = useState({
    punctuality: 0,
    work_quality: 0,
    communication: 0,
    attitude: 0,
    payment_timeliness: 0,
    work_environment: 0,
    fairness: 0,
  });
  const [feedback, setFeedback] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const setCategory = (key, val) => {
    setCategories((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (overallRating === 0) {
      setError("Please select an overall rating before submitting.");
      return;
    }
    if (feedback && feedback.length < 20) {
      setError("Written feedback must be at least 20 characters if provided.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        job_id: jobId,
        reviewee_id: revieweeId,
        reviewer_role: reviewerRole,
        overall_rating: overallRating,
        written_feedback: feedback.trim() || null,
        is_anonymous: isAnonymous,
      };

      if (!compact) {
        if (isEmployer) {
          if (categories.punctuality > 0) payload.punctuality = categories.punctuality;
          if (categories.work_quality > 0) payload.work_quality = categories.work_quality;
          if (categories.communication > 0) payload.communication = categories.communication;
          if (categories.attitude > 0) payload.attitude = categories.attitude;
        } else {
          if (categories.payment_timeliness > 0) payload.payment_timeliness = categories.payment_timeliness;
          if (categories.work_environment > 0) payload.work_environment = categories.work_environment;
          if (categories.communication > 0) payload.communication = categories.communication;
          if (categories.fairness > 0) payload.fairness = categories.fairness;
        }
      }

      const res = await reviewsAPI.submitReview(payload);
      onSuccess && onSuccess(res.data);
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to submit review. Please try again.";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  const workerCategories = [
    { key: "punctuality", label: "Punctuality" },
    { key: "work_quality", label: "Work Quality" },
    { key: "communication", label: "Communication" },
    { key: "attitude", label: "Attitude" },
  ];

  const employerCategories = [
    { key: "payment_timeliness", label: "Payment Timeliness" },
    { key: "work_environment", label: "Work Environment" },
    { key: "communication", label: "Communication" },
    { key: "fairness", label: "Fairness" },
  ];

  const categoryList = isEmployer ? workerCategories : employerCategories;
  const subjectLabel = isEmployer ? "Worker" : "Employer";

  return (
    <div
      style={{
        background: "#fff",
        border: compact ? "none" : "1px solid #e5e7eb",
        borderRadius: compact ? "0" : "16px",
        padding: compact ? "0" : "2rem",
        boxShadow: compact ? "none" : "0 4px 20px rgba(0,0,0,0.08)",
        maxWidth: compact ? "100%" : "600px",
        width: "100%",
        margin: "0 auto",
      }}
    >
      <div style={{ marginBottom: compact ? "1rem" : "1.5rem" }}>
        <h2 style={{ margin: 0, fontSize: compact ? "1.05rem" : "1.3rem", fontWeight: 700 }}>
          ✍️ Write a Review
        </h2>
        <p style={{ margin: "0.25rem 0 0", color: "#6b7280", fontSize: compact ? "0.84rem" : "0.9rem" }}>
          Share your experience with this {subjectLabel.toLowerCase()}. Reviews are visible to all platform users.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: compact ? "1rem" : "1.5rem" }}>
          <label
            style={{
              display: "block",
              fontWeight: 600,
              marginBottom: "0.5rem",
              fontSize: compact ? "0.9rem" : "0.95rem",
            }}
          >
            Overall Rating <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <StarRating value={overallRating} onChange={setOverallRating} size="lg" />
            {overallRating > 0 && (
              <span
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#92400e",
                  background: "#fef3c7",
                  padding: "2px 10px",
                  borderRadius: "999px",
                }}
              >
                {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][overallRating]}
              </span>
            )}
          </div>
        </div>

        {!compact && (
          <div style={{ marginBottom: "1.5rem" }}>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: "0.5rem",
                fontSize: "0.95rem",
              }}
            >
              Category Ratings{" "}
              <span style={{ color: "#9ca3af", fontWeight: 400 }}>(optional)</span>
            </label>
            <div>
              {categoryList.map((cat) => (
                <CategoryRating
                  key={cat.key}
                  label={cat.label}
                  value={categories[cat.key]}
                  onChange={(val) => setCategory(cat.key, val)}
                />
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: compact ? "1rem" : "1.5rem" }}>
          <label
            style={{
              display: "block",
              fontWeight: 600,
              marginBottom: "0.5rem",
              fontSize: compact ? "0.9rem" : "0.95rem",
            }}
          >
            Written Feedback{" "}
            <span style={{ color: "#9ca3af", fontWeight: 400 }}>(optional, 20-500 chars)</span>
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder={`Describe your experience with this ${subjectLabel.toLowerCase()}...`}
            maxLength={500}
            rows={compact ? 3 : 4}
            style={{
              width: "100%",
              padding: "0.75rem",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              fontSize: "0.9rem",
              resize: "vertical",
              outline: "none",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
          <div
            style={{
              textAlign: "right",
              fontSize: "0.75rem",
              color: feedback.length > 450 ? "#ef4444" : "#9ca3af",
              marginTop: "2px",
            }}
          >
            {feedback.length}/500
          </div>
        </div>

        {!compact && (
          <div style={{ marginBottom: "1.5rem" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                cursor: "pointer",
                fontSize: "0.9rem",
                color: "#374151",
              }}
            >
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
              <span>
                Submit anonymously{" "}
                <span style={{ color: "#9ca3af" }}>(your name won't be shown publicly)</span>
              </span>
            </label>
          </div>
        )}

        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fca5a5",
              borderRadius: "8px",
              padding: "0.75rem 1rem",
              color: "#dc2626",
              fontSize: "0.875rem",
              marginBottom: "1rem",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem", flexDirection: compact ? "row-reverse" : "row" }}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              style={{
                flex: 1,
                padding: compact ? "0.8rem" : "0.875rem",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                background: "#f9fafb",
                color: "#374151",
                fontSize: "0.95rem",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading || overallRating === 0}
            style={{
              flex: 2,
              padding: compact ? "0.8rem" : "0.875rem",
              borderRadius: "8px",
              border: "none",
              background: loading || overallRating === 0 ? "#9ca3af" : "linear-gradient(135deg, #4f46e5, #7c3aed)",
              color: "#fff",
              fontSize: "0.95rem",
              cursor: loading || overallRating === 0 ? "not-allowed" : "pointer",
              fontWeight: 600,
              transition: "all 0.2s",
            }}
          >
            {loading ? "Submitting..." : "Submit Review"}
          </button>
        </div>
      </form>
    </div>
  );
}
