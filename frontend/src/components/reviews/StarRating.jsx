import React, { useState } from "react";

/**
 * StarRating — reusable interactive star input
 *
 * Props:
 *   value       {number}   current rating (1–5), 0 = none selected
 *   onChange    {function} called with new rating value when a star is clicked
 *   readOnly    {boolean}  when true, purely decorative (no click/hover)
 *   size        {string}   "sm" | "md" | "lg"  (default "md")
 *   showValue   {boolean}  display numeric value beside stars
 */
export default function StarRating({
  value = 0,
  onChange,
  readOnly = false,
  size = "md",
  showValue = false,
}) {
  const [hovered, setHovered] = useState(0);

  const sizes = {
    sm: { star: "1rem", gap: "0.1rem" },
    md: { star: "1.5rem", gap: "0.15rem" },
    lg: { star: "2rem", gap: "0.2rem" },
  };
  const s = sizes[size] || sizes.md;

  const displayValue = readOnly ? value : (hovered || value);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: s.gap,
        userSelect: "none",
      }}
      aria-label={`Rating: ${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= displayValue;
        return (
          <span
            key={star}
            role={readOnly ? "img" : "button"}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            onClick={() => {
              if (!readOnly && onChange) onChange(star);
            }}
            onMouseEnter={() => {
              if (!readOnly) setHovered(star);
            }}
            onMouseLeave={() => {
              if (!readOnly) setHovered(0);
            }}
            style={{
              fontSize: s.star,
              cursor: readOnly ? "default" : "pointer",
              color: filled ? "#f59e0b" : "#d1d5db",
              transition: "color 0.15s ease, transform 0.1s ease",
              transform: !readOnly && hovered === star ? "scale(1.2)" : "scale(1)",
              display: "inline-block",
              lineHeight: 1,
            }}
          >
            ★
          </span>
        );
      })}
      {showValue && (
        <span
          style={{
            fontSize: size === "sm" ? "0.75rem" : "0.9rem",
            fontWeight: 600,
            color: value > 0 ? "#92400e" : "#9ca3af",
            marginLeft: "0.25rem",
          }}
        >
          {value > 0 ? `${Number(value).toFixed(1)}` : "—"}
        </span>
      )}
    </span>
  );
}
