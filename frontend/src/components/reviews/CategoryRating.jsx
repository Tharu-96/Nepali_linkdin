import React from "react";
import StarRating from "./StarRating";

/**
 * CategoryRating — a labelled row for a single category rating
 *
 * Props:
 *   label     {string}   displayed name of the category
 *   value     {number}   current rating 1–5 (0 = not set)
 *   onChange  {function} called with new value
 *   readOnly  {boolean}  display-only mode
 *   required  {boolean}  show asterisk indicator
 */
export default function CategoryRating({
  label,
  value = 0,
  onChange,
  readOnly = false,
  required = false,
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "0.45rem 0.75rem",
        padding: "0.6rem 0.75rem",
        borderRadius: "8px",
        background: "rgba(248, 250, 252, 0.8)",
        border: "1px solid #e5e7eb",
        marginBottom: "0.5rem",
        transition: "background 0.15s",
      }}
    >
      <span
        style={{
          fontSize: "0.9rem",
          fontWeight: 500,
          color: "#374151",
          flex: "1 1 130px",
          minWidth: 0,
        }}
      >
        {label}
        {required && (
          <span style={{ color: "#ef4444", marginLeft: "2px" }}>*</span>
        )}
      </span>
      <StarRating
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        size="sm"
        showValue={readOnly && value > 0}
      />
    </div>
  );
}
