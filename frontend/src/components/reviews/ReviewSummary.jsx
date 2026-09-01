import React from "react";
import StarRating from "./StarRating";

/**
 * ReviewSummary — Shows aggregated rating breakdown on a user profile page.
 *
 * Props:
 *   summary   {object}   data from GET /reviews/summary/{user_id}
 *   userRole  {string}   'worker' or 'employer' — determines which categories to show
 */
export default function ReviewSummary({ summary, userRole = "worker" }) {
  if (!summary || summary.total_reviews === 0) {
    return (
      <div
        style={{
          background: "#f9fafb",
          border: "1px dashed #d1d5db",
          borderRadius: "12px",
          padding: "2rem",
          textAlign: "center",
          color: "#6b7280",
        }}
      >
        <span style={{ fontSize: "2rem", display: "block", marginBottom: "0.5rem" }}>⭐</span>
        <p style={{ margin: 0, fontWeight: 500 }}>No reviews yet</p>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem" }}>
          Reviews will appear here once jobs are completed.
        </p>
      </div>
    );
  }

  const overallVal = summary.avg_overall ?? 0;

  const workerCategories = [
    { label: "Punctuality", val: summary.avg_punctuality },
    { label: "Work Quality", val: summary.avg_work_quality },
    { label: "Communication", val: summary.avg_communication },
    { label: "Attitude", val: summary.avg_attitude },
  ].filter((c) => c.val != null);

  const employerCategories = [
    { label: "Payment Timeliness", val: summary.avg_payment_timeliness },
    { label: "Work Environment", val: summary.avg_work_environment },
    { label: "Communication", val: summary.avg_communication },
    { label: "Fairness", val: summary.avg_fairness },
  ].filter((c) => c.val != null);

  const categories = userRole === "employer" ? employerCategories : workerCategories;

  const RatingBar = ({ label, val }) => {
    const pct = ((val ?? 0) / 5) * 100;
    return (
      <div style={{ marginBottom: "0.6rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.25rem",
          }}
        >
          <span style={{ fontSize: "0.85rem", color: "#4b5563", fontWeight: 500 }}>
            {label}
          </span>
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#92400e" }}>
            {Number(val).toFixed(1)}
          </span>
        </div>
        <div
          style={{
            height: "6px",
            background: "#e5e7eb",
            borderRadius: "999px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: "linear-gradient(90deg, #f59e0b, #d97706)",
              borderRadius: "999px",
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "14px",
        padding: "1.5rem",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      {/* Overall score */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1.25rem",
          marginBottom: "1.5rem",
          paddingBottom: "1.25rem",
          borderBottom: "1px solid #f3f4f6",
        }}
      >
        {/* Big number */}
        <div
          style={{
            textAlign: "center",
            minWidth: "80px",
            padding: "1rem",
            background: "linear-gradient(135deg, #fffbeb, #fef3c7)",
            borderRadius: "12px",
            border: "1px solid #fde68a",
          }}
        >
          <div
            style={{
              fontSize: "2.5rem",
              fontWeight: 800,
              color: "#92400e",
              lineHeight: 1,
            }}
          >
            {overallVal > 0 ? Number(overallVal).toFixed(1) : "—"}
          </div>
          <div style={{ fontSize: "0.7rem", color: "#b45309", marginTop: "4px" }}>
            out of 5
          </div>
        </div>

        {/* Stars + review count */}
        <div>
          <StarRating value={Math.round(overallVal)} readOnly size="md" />
          <p
            style={{
              margin: "0.4rem 0 0",
              fontSize: "0.85rem",
              color: "#6b7280",
            }}
          >
            Based on{" "}
            <strong style={{ color: "#374151" }}>{summary.total_reviews}</strong>{" "}
            review{summary.total_reviews !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Category breakdowns */}
      {categories.length > 0 && (
        <div>
          <p
            style={{
              margin: "0 0 0.75rem",
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "#9ca3af",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Category Breakdown
          </p>
          {categories.map((cat) => (
            <RatingBar key={cat.label} label={cat.label} val={cat.val} />
          ))}
        </div>
      )}
    </div>
  );
}
