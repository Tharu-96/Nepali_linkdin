import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { paymentsAPI } from "../../api";
import { useAuth } from "../../context/AuthContext";

const STATUS_STYLES = {
  success: { bg: "#dcfce7", color: "#166534", icon: "✅", label: "Paid" },
  pending: { bg: "#fef3c7", color: "#92400e", icon: "⏳", label: "Pending" },
  failed: { bg: "#fee2e2", color: "#991b1b", icon: "❌", label: "Failed" },
};

STATUS_STYLES.cancelled = { bg: "#f1f5f9", color: "#475569", icon: "⊘", label: "Cancelled" };

const GATEWAY_LOGOS = {
  esewa: { label: "eSewa", bg: "#ecfdf5", color: "#065f46" },
  khalti: { label: "Khalti", bg: "#eef2ff", color: "#3730a3" },
};

function StatusPill({ status }) {
  const s = STATUS_STYLES[status] || { bg: "#f3f4f6", color: "#374151", icon: "•", label: status };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "4px 12px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 600,
        backgroundColor: s.bg,
        color: s.color,
      }}
    >
      {s.icon} {s.label}
    </span>
  );
}

export default function PaymentHistory() {
  const { role } = useAuth();
  const [payments, setPayments] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingTxId, setCancellingTxId] = useState(null);

  const fetchPayments = async () => {
    setLoading(true);
    setError("");
    try {
      const [paymentResponse, walletResponse] = await Promise.all([
        paymentsAPI.getMyPayments(),
        role === "worker" ? paymentsAPI.getMyWallet() : Promise.resolve(null),
      ]);
      setPayments(paymentResponse.data);
      setWallet(walletResponse?.data || null);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to load payment history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [role]);

  const fmt = (n) =>
    `Rs. ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const fmtDate = (d) =>
    d
      ? new Date(d).toLocaleDateString("en-NP", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "—";

  // Summary totals
  const totals = payments.reduce(
    (acc, p) => {
      if (p.status === "success") {
        acc.gross += Number(p.gross_amount_npr);
        acc.commission += Number(p.commission_amount_npr);
        acc.net += Number(p.net_amount_npr);
        acc.count += 1;
      }
      return acc;
    },
    { gross: 0, commission: 0, net: 0, count: 0 }
  );

  const isWorker = role === "worker";

  const cancelPendingPayment = async (transactionId) => {
    if (!window.confirm("Cancel this pending payment? It cannot be paid through Rozgar after cancellation.")) return;
    setError("");
    setCancellingTxId(transactionId);
    try {
      await paymentsAPI.cancelPayment(transactionId);
      setPayments((currentPayments) =>
        currentPayments.map((payment) => payment.id === transactionId ? { ...payment, status: "cancelled" } : payment)
      );
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to cancel the payment.");
    } finally {
      setCancellingTxId(null);
    }
  };

  return (
    <div style={{ maxWidth: "950px", margin: "2rem auto", padding: "0 1rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 700, color: "#111827" }}>
          💳 Payment History
        </h1>
        <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "0.9rem" }}>
          {isWorker
            ? "Your earnings from completed jobs"
            : "Payments you made to workers for completed jobs"}
        </p>
      </div>

      {isWorker && wallet && (
        <div
          style={{
            background: "linear-gradient(135deg, #ecfdf5, #f0fdf4)",
            border: "1px solid #86efac",
            borderRadius: "14px",
            padding: "18px 20px",
            marginBottom: "20px",
          }}
        >
          <div style={{ color: "#166534", fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase" }}>
            Rozgar Wallet
          </div>
          <div style={{ color: "#14532d", fontSize: "1.7rem", fontWeight: 800, marginTop: "4px" }}>
            {fmt(wallet.balance_npr)}
          </div>
          <p style={{ color: "#166534", fontSize: "0.82rem", margin: "6px 0 0" }}>
            {wallet.total_credits} verified payment credit.{wallet.total_credits !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Summary cards (only shown when there are successful payments) */}
      {totals.count > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          {[
            {
              label: isWorker ? "Total Earned" : "Total Paid Out",
              value: fmt(isWorker ? totals.net : totals.net + totals.commission),
              icon: "💵",
              accent: "#4f46e5",
            },
            { label: "Platform Fee Paid by Employer", value: fmt(totals.commission), icon: "🏦", accent: "#f59e0b" },
            { label: "Completed Payments", value: totals.count, icon: "✅", accent: "#10b981" },
          ].filter((card) => !isWorker || card.label !== "Platform Fee Paid by Employer").map((card) => (
            <div
              key={card.label}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "16px 18px",
                borderLeft: `4px solid ${card.accent}`,
              }}
            >
              <div style={{ fontSize: "1.3rem", marginBottom: "6px" }}>{card.icon}</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111827" }}>
                {card.value}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: "2px" }}>
                {card.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            borderRadius: "10px",
            padding: "14px 18px",
            color: "#991b1b",
            marginBottom: "16px",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#6b7280" }}>
          <div
            style={{
              width: "38px",
              height: "38px",
              border: "3px solid #e5e7eb",
              borderTop: "3px solid #4f46e5",
              borderRadius: "50%",
              margin: "0 auto 12px",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <p>Loading payment history…</p>
          <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
        </div>
      ) : payments.length === 0 ? (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "16px",
            padding: "60px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "3.5rem", marginBottom: "16px" }}>💳</div>
          <h3 style={{ margin: 0, color: "#374151", fontWeight: 600 }}>No payments yet</h3>
          <p style={{ color: "#6b7280", marginTop: "8px", fontSize: "0.9rem" }}>
            {isWorker
              ? "Payments will appear here once an employer pays you for a completed job."
              : "Payments you make to workers will appear here."}
          </p>
          <Link
            to="/jobs"
            style={{
              display: "inline-block",
              marginTop: "20px",
              padding: "10px 24px",
              background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
              color: "#fff",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "0.9rem",
            }}
          >
            Browse Jobs
          </Link>
        </div>
      ) : (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "14px",
            overflow: "hidden",
          }}
        >
          {/* Desktop table */}
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
                fontSize: "0.875rem",
              }}
            >
              <thead style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                <tr>
                  {[
                    "Job",
                    isWorker ? "Employer" : "Worker",
                    "Gateway",
                    "Worker Payment",
                    "Platform Fee",
                    isWorker ? "Received" : "Total Paid",
                    "Status",
                    "Date",
                    ...(!isWorker ? ["Action"] : []),
                  ].filter((h) => !isWorker || h !== "Platform Fee").map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 16px",
                        color: "#6b7280",
                        fontWeight: 600,
                        fontSize: "11px",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((tx, idx) => {
                  const gw = GATEWAY_LOGOS[tx.gateway] || { label: tx.gateway, bg: "#f3f4f6", color: "#374151" };
                  return (
                    <tr
                      key={tx.id}
                      style={{
                        borderBottom: "1px solid #e5e7eb",
                        background: idx % 2 === 0 ? "#fff" : "#fafafa",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f9ff")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? "#fff" : "#fafafa")}
                    >
                      {/* Job */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 600, color: "#111827" }}>
                          {tx.job_title || `Job #${tx.job_id}`}
                        </div>
                        <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>
                          ID #{tx.job_id}
                        </div>
                      </td>

                      {/* Counterpart */}
                      <td style={{ padding: "14px 16px", color: "#374151" }}>
                        {tx.counterpart_name || "—"}
                      </td>

                      {/* Gateway */}
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            padding: "3px 10px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 700,
                            backgroundColor: gw.bg,
                            color: gw.color,
                            textTransform: "uppercase",
                          }}
                        >
                          {gw.label}
                        </span>
                      </td>

                      {/* Agreed worker payment */}
                      <td style={{ padding: "14px 16px", fontWeight: 600, color: "#111827" }}>
                        {fmt(tx.gross_amount_npr)}
                      </td>

                      {!isWorker && (
                        <td style={{ padding: "14px 16px", color: "#f59e0b", fontWeight: 500 }}>
                          {fmt(tx.commission_amount_npr)}
                        </td>
                      )}
                      <td style={{ padding: "14px 16px", color: "#10b981", fontWeight: 700 }}>
                        {fmt(isWorker ? tx.net_amount_npr : Number(tx.net_amount_npr) + Number(tx.commission_amount_npr))}
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px 16px" }}>
                        <StatusPill status={tx.status} />
                      </td>

                      {/* Date */}
                      <td style={{ padding: "14px 16px", color: "#6b7280", whiteSpace: "nowrap" }}>
                        <div>{fmtDate(tx.initiated_at)}</div>
                        {tx.completed_at && (
                          <div style={{ fontSize: "11px", color: "#9ca3af" }}>
                            Paid: {fmtDate(tx.completed_at)}
                          </div>
                        )}
                      </td>

                      {!isWorker && (
                        <td style={{ padding: "14px 16px" }}>
                          {tx.status === "pending" ? (
                            <button
                              type="button"
                              onClick={() => cancelPendingPayment(tx.id)}
                              disabled={cancellingTxId === tx.id}
                              style={{ padding: "6px 14px", borderRadius: "6px", border: "1px solid #fecaca", background: "#fff1f2", cursor: cancellingTxId === tx.id ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: 600, color: "#be123c", opacity: cancellingTxId === tx.id ? 0.65 : 1, whiteSpace: "nowrap" }}
                            >
                              {cancellingTxId === tx.id ? "Cancelling..." : "Cancel"}
                            </button>
                          ) : (
                            <span style={{ color: "#d1d5db" }}>-</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "10px 20px",
              background: "#f9fafb",
              borderTop: "1px solid #e5e7eb",
              color: "#6b7280",
              fontSize: "0.8rem",
            }}
          >
            {payments.length} transaction{payments.length !== 1 ? "s" : ""} found
          </div>
        </div>
      )}
    </div>
  );
}
