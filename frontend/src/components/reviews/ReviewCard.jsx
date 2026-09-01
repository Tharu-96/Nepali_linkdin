import React, { useState } from "react";
import StarRating from "./StarRating";
import CategoryRating from "./CategoryRating";

/**
 * ReviewCard displays a single review.
 *
 * Props:
 *   review    {object}   review data from API
 *   isAdmin   {boolean}  if true, show admin delete button
 *   onDelete  {function} admin callback to delete review
 */
export default function ReviewCard({ review, isAdmin = false, onDelete, showReviewee = false }) {
  const [flagged] = useState(review.is_flagged);

  const isEmployerReview = review.reviewer_role === "employer";
  const displayName = showReviewee
    ? review.reviewee_name || `Worker #${review.reviewee_id}`
    : review.reviewer_name || "Anonymous";
  const displayLabel = showReviewee
    ? "Reviewed worker"
    : `${isEmployerReview ? "Employer" : "Worker"} review`;

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-NP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const categoryEntries = isEmployerReview
    ? [
        { label: "Punctuality", val: review.punctuality },
        { label: "Work Quality", val: review.work_quality },
        { label: "Communication", val: review.communication },
        { label: "Attitude", val: review.attitude },
      ]
    : [
        { label: "Payment Timeliness", val: review.payment_timeliness },
        { label: "Work Environment", val: review.work_environment },
        { label: "Communication", val: review.communication },
        { label: "Fairness", val: review.fairness },
      ];

  const filledCategories = categoryEntries.filter((c) => c.val != null);

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        padding: "1.25rem 1.5rem",
        boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
        position: "relative",
        transition: "box-shadow 0.2s",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "0.75rem",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "1rem",
              flexShrink: 0,
            }}
          >
            {displayName ? displayName.charAt(0).toUpperCase() : "?"}
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: "0.95rem" }}>
              {displayName}
            </p>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#6b7280" }}>
              {displayLabel} · {formatDate(review.created_at)}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <StarRating value={review.overall_rating} readOnly size="sm" />
          <span
            style={{
              fontWeight: 700,
              color: "#92400e",
              fontSize: "0.9rem",
            }}
          >
            {review.overall_rating}/5
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
        {review.is_anonymous && (
          <span
            style={{
              fontSize: "0.7rem",
              background: "#f3f4f6",
              color: "#6b7280",
              padding: "2px 8px",
              borderRadius: "999px",
              fontWeight: 500,
            }}
          >
            Anonymous
          </span>
        )}
        {flagged && (
          <span
            style={{
              fontSize: "0.7rem",
              background: "#fef3c7",
              color: "#92400e",
              padding: "2px 8px",
              borderRadius: "999px",
              fontWeight: 500,
            }}
          >
            Flagged
          </span>
        )}
      </div>

      {filledCategories.length > 0 && (
        <div style={{ marginBottom: "0.75rem" }}>
          <p
            style={{
              margin: "0 0 0.4rem",
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "#9ca3af",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Category Ratings
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
              gap: "0.35rem",
            }}
          >
            {filledCategories.map((cat) => (
              <CategoryRating
                key={cat.label}
                label={cat.label}
                value={cat.val}
                readOnly
              />
            ))}
          </div>
        </div>
      )}

      {review.written_feedback && (
        <blockquote
          style={{
            margin: "0.75rem 0 0",
            padding: "0.75rem 1rem",
            borderLeft: "3px solid #4f46e5",
            background: "#f9fafb",
            borderRadius: "0 8px 8px 0",
            color: "#374151",
            fontSize: "0.9rem",
            lineHeight: 1.6,
            fontStyle: "italic",
          }}
        >
          "{review.written_feedback}"
        </blockquote>
      )}

      {isAdmin && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "1rem",
          }}
        >
          <button
            onClick={() => onDelete && onDelete(review.id)}
            style={{
              background: "#fef2f2",
              border: "1px solid #fca5a5",
              borderRadius: "6px",
              padding: "4px 12px",
              fontSize: "0.78rem",
              color: "#ef4444",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
