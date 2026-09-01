import React, { useEffect, useState, useMemo } from "react";
import { adminAPI } from "../../api";
import PaginationControls from "../../components/admin/PaginationControls";

const STATUS_COLORS = {
  success: { bg: "#dcfce7", color: "#166534", label: "✅ Success" },
  pending: { bg: "#fef3c7", color: "#92400e", label: "⏳ Pending" },
  failed: { bg: "#fee2e2", color: "#991b1b", label: "❌ Failed" },
};

const GATEWAY_COLORS = {
  esewa: { bg: "#ecfdf5", color: "#065f46" },
  khalti: { bg: "#eef2ff", color: "#3730a3" },
};

STATUS_COLORS.cancelled = { bg: "#f1f5f9", color: "#475569", label: "Cancelled" };

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || { bg: "#f3f4f6", color: "#374151", label: status };
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 600,
        backgroundColor: s.bg,
        color: s.color,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

function GatewayBadge({ gateway }) {
  const g = GATEWAY_COLORS[gateway] || { bg: "#f3f4f6", color: "#374151" };
  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: "6px",
        fontSize: "12px",
        fontWeight: 700,
        backgroundColor: g.bg,
        color: g.color,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {gateway}
    </span>
  );
}

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterGateway, setFilterGateway] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Summary totals
  const totals = useMemo(() => {
    const filtered = transactions.filter((tx) => {
      const matchStatus = !filterStatus || tx.status === filterStatus;
      const matchGateway = !filterGateway || tx.gateway === filterGateway;
      const matchSearch =
        !search ||
        tx.job_title?.toLowerCase().includes(search.toLowerCase()) ||
        tx.employer_name?.toLowerCase().includes(search.toLowerCase()) ||
        tx.worker_name?.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchGateway && matchSearch;
    });
    return {
      count: filtered.length,
      gross: filtered.reduce((sum, tx) => sum + Number(tx.gross_amount_npr), 0),
      commission: filtered.reduce((sum, tx) => sum + Number(tx.commission_amount_npr), 0),
      net: filtered.reduce((sum, tx) => sum + Number(tx.net_amount_npr), 0),
      data: filtered,
    };
  }, [transactions, filterStatus, filterGateway, search]);

  // Pending and cancelled checkout attempts are not completed payments.
  const paymentSummary = useMemo(() => transactions.reduce(
    (summary, transaction) => {
      const gross = Number(transaction.gross_amount_npr || 0);
      const commission = Number(transaction.commission_amount_npr || 0);
      const net = Number(transaction.net_amount_npr || 0);

      if (transaction.status === "success") {
        summary.completedCount += 1;
        summary.completedGross += net + commission;
        summary.completedCommission += commission;
        summary.completedNet += net;
      } else if (transaction.status === "pending") {
        summary.pendingAmount += net + commission;
      } else if (transaction.status === "cancelled") {
        summary.cancelledAmount += net + commission;
      }
      return summary;
    },
    { completedCount: 0, completedGross: 0, completedCommission: 0, completedNet: 0, pendingAmount: 0, cancelledAmount: 0 }
  ), [transactions]);

  const paginatedTransactions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return totals.data.slice(start, start + pageSize);
  }, [totals.data, page]);

  const totalPages = Math.max(1, Math.ceil(totals.data.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterGateway, search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminAPI.getTransactions();
      setTransactions(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n) =>
    `Rs. ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-NP", { day: "2-digit", month: "short", year: "numeric" }) : "—");

  return (
    <div style={{ padding: "24px" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "#111827" }}>
          💳 Payment Transactions
        </h2>
        <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "0.9rem" }}>
          All platform transactions — filter by status or payment gateway
        </p>
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        {[
          { label: "Total Collected", value: fmt(paymentSummary.completedGross), icon: "Rs", accent: "#0891b2" },
          { label: "Platform Commission", value: fmt(paymentSummary.completedCommission), icon: "%", accent: "#f59e0b" },
          { label: "Paid to Workers", value: fmt(paymentSummary.completedNet), icon: "→", accent: "#10b981" },
          { label: "Pending Amount", value: fmt(paymentSummary.pendingAmount), icon: "…", accent: "#d97706" },
          { label: "Cancelled Amount", value: fmt(paymentSummary.cancelledAmount), icon: "⊘", accent: "#64748b" },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              padding: "16px 20px",
              borderLeft: `4px solid ${card.accent}`,
            }}
          >
            <div style={{ fontSize: "1.4rem", marginBottom: "6px" }}>{card.icon}</div>
            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#111827" }}>
              {card.value}
            </div>
            <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: "2px" }}>
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "20px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          type="text"
          placeholder="Search job, employer, or worker…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: "1",
            minWidth: "220px",
            padding: "9px 14px",
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            fontSize: "0.9rem",
            outline: "none",
          }}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            padding: "9px 14px",
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            fontSize: "0.9rem",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          <option value="">All Statuses</option>
          <option value="success">Success</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={filterGateway}
          onChange={(e) => setFilterGateway(e.target.value)}
          style={{
            padding: "9px 14px",
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            fontSize: "0.9rem",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          <option value="">All Gateways</option>
          <option value="esewa">eSewa</option>
          <option value="khalti">Khalti</option>
        </select>
        <button
          onClick={fetchTransactions}
          style={{
            padding: "9px 18px",
            borderRadius: "8px",
            border: "none",
            background: "#4f46e5",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            borderRadius: "8px",
            padding: "12px 16px",
            color: "#991b1b",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#6b7280" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "3px solid #e5e7eb",
              borderTop: "3px solid #4f46e5",
              borderRadius: "50%",
              margin: "0 auto 12px",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <p>Loading transactions…</p>
          <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
        </div>
      ) : totals.data.length === 0 ? (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "60px",
            textAlign: "center",
            color: "#6b7280",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "12px" }}>💳</div>
          <p style={{ fontSize: "1.1rem", fontWeight: 500, color: "#374151" }}>
            No transactions found
          </p>
          <p style={{ fontSize: "0.875rem" }}>
            {filterStatus || filterGateway || search
              ? "Try clearing the filters."
              : "Transactions will appear here once payments are processed."}
          </p>
        </div>
      ) : (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
              <thead style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                <tr>
                  {[
                    "Transaction ID",
                    "Job",
                    "Employer",
                    "Worker",
                    "Gateway",
                    "Worker Payment (Rs.)",
                    "Platform Fee",
                    "Employer Total",
                    "Date",
                    "Payment State",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 16px",
                        color: "#6b7280",
                        fontWeight: 600,
                        fontSize: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        whiteSpace: "nowrap",
                        textAlign: ["Worker Payment (Rs.)", "Platform Fee", "Employer Total", "Date"].includes(h) ? "center" : "left",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.map((tx, idx) => (
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
                    <td style={{ padding: "12px 16px", color: "#9ca3af", fontFamily: "monospace", fontSize: "11px" }}>
                      {String(tx.id).substring(0, 8)}…
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 500, color: "#111827", maxWidth: "160px" }}>
                      <span title={tx.job_title}>
                        {tx.job_title ? (tx.job_title.length > 22 ? tx.job_title.substring(0, 20) + "…" : tx.job_title) : `#${tx.job_id}`}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#374151" }}>{tx.employer_name || "—"}</td>
                    <td style={{ padding: "12px 16px", color: "#374151" }}>{tx.worker_name || "—"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <GatewayBadge gateway={tx.gateway} />
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "#111827", textAlign: "center" }}>
                      {Number(tx.gross_amount_npr).toLocaleString("en-IN")}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#f59e0b", fontWeight: 500, textAlign: "center" }}>
                      {Number(tx.commission_amount_npr).toLocaleString("en-IN")}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#10b981", fontWeight: 600, textAlign: "center" }}>
                      {(Number(tx.net_amount_npr) + Number(tx.commission_amount_npr)).toLocaleString("en-IN")}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#6b7280", whiteSpace: "nowrap", textAlign: "center" }}>
                      {fmtDate(tx.initiated_at)}
                    </td>
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                      <span style={{ color: tx.status === "success" ? "#15803d" : tx.status === "pending" ? "#b45309" : "#64748b", fontWeight: 600 }}>
                        {tx.status === "success" ? "Payment Received" : tx.status === "pending" ? "Awaiting Payment" : tx.status === "cancelled" ? "Payment Cancelled" : tx.status === "failed" ? "Payment Failed" : tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "12px 20px",
              background: "#f9fafb",
              borderTop: "1px solid #e5e7eb",
              color: "#6b7280",
              fontSize: "0.8rem",
            }}
          >
            Showing <strong style={{ color: "#374151" }}>{totals.data.length}</strong> of{" "}
            <strong style={{ color: "#374151" }}>{transactions.length}</strong> transactions
          </div>
          <PaginationControls
            page={page}
            totalPages={totalPages}
            totalItems={totals.data.length}
            pageSize={paginatedTransactions.length}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
