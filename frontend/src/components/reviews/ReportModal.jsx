import React, { useState } from "react";
import { reviewsAPI } from "../../api";

/**
 * ReportModal — worker/employer reports a review as inappropriate
 *
 * Props:
 *   reviewId   {number}   ID of the review to report
 *   onClose    {function} close the modal without action
 *   onReported {function} called after successful report submission
 */
export default function ReportModal({ reviewId, onClose, onReported }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleReport = async () => {
    setLoading(true);
    setError("");
    try {
      await reviewsAPI.reportReview(reviewId);
      onReported();
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        "Failed to report review. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        backdropFilter: "blur(2px)",
      }}
    >
      {/* Modal box — stop propagation so clicking inside doesn't close */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: "14px",
          padding: "2rem",
          maxWidth: "440px",
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          animation: "slideUp 0.2s ease",
        }}
      >
        {/* Icon */}
        <div style={{ textAlign: "center", marginBottom: "1rem" }}>
          <span style={{ fontSize: "2.5rem" }}>🚩</span>
        </div>

        <h3
          style={{
            margin: "0 0 0.5rem",
            textAlign: "center",
            fontSize: "1.15rem",
            fontWeight: 700,
          }}
        >
          Report this Review
        </h3>
        <p
          style={{
            margin: "0 0 1.5rem",
            textAlign: "center",
            color: "#6b7280",
            fontSize: "0.9rem",
            lineHeight: 1.5,
          }}
        >
          This review will be flagged for admin review. If confirmed
          inappropriate, it will be removed.
        </p>

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
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              flex: 1,
              padding: "0.75rem",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              background: "#f9fafb",
              color: "#374151",
              fontSize: "0.9rem",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleReport}
            disabled={loading}
            style={{
              flex: 1,
              padding: "0.75rem",
              borderRadius: "8px",
              border: "none",
              background: loading ? "#9ca3af" : "#ef4444",
              color: "#fff",
              fontSize: "0.9rem",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 600,
              transition: "background 0.2s",
            }}
          >
            {loading ? "Reporting…" : "Submit Report"}
          </button>
        </div>
      </div>
    </div>
  );
}
