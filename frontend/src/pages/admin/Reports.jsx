import React, { useEffect, useMemo, useState } from "react";
import { adminAPI } from "../../api";
import PaginationControls from "../../components/admin/PaginationControls";

const REPORT_TYPES = [
  { key: "workers", label: "Workers" },
  { key: "employers", label: "Employers" },
  { key: "jobs", label: "Jobs" },
  { key: "applications", label: "Applications" },
  { key: "transactions", label: "Transactions" },
  { key: "reviews", label: "Reviews" },
];

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : "";
}

function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function datasetConfig(type) {
  switch (type) {
    case "workers":
      return {
        title: "Workers Export",
        fetcher: () => adminAPI.getWorkers(),
        columns: [
          { key: "name", label: "Name" },
          { key: "email", label: "Email" },
          { key: "join_date", label: "Join Date", render: (row) => formatDate(row.join_date) },
          { key: "total_applications", label: "Applications" },
          { key: "avg_rating", label: "Rating", render: (row) => Number(row.avg_rating || 0).toFixed(1) },
          { key: "is_active", label: "Status", render: (row) => (row.is_active ? "Active" : "Suspended") },
        ],
        filename: "workers-report.csv",
      };
    case "employers":
      return {
        title: "Employers Export",
        fetcher: () => adminAPI.getEmployers(),
        columns: [
          { key: "company_name", label: "Company" },
          { key: "email", label: "Email" },
          { key: "total_jobs_posted", label: "Jobs Posted" },
          { key: "total_revenue_paid", label: "Revenue (NPR)", render: (row) => Number(row.total_revenue_paid || 0).toLocaleString() },
          { key: "avg_rating", label: "Rating", render: (row) => Number(row.avg_rating || 0).toFixed(1) },
          { key: "is_active", label: "Status", render: (row) => (row.is_active ? "Active" : "Suspended") },
        ],
        filename: "employers-report.csv",
      };
    case "jobs":
      return {
        title: "Jobs Export",
        fetcher: () => adminAPI.getJobs(),
        columns: [
          { key: "title", label: "Title" },
          { key: "employer_name", label: "Employer" },
          { key: "status", label: "Job Status" },
          { key: "is_urgent", label: "Priority", render: (row) => (row.is_urgent ? "Urgent" : "Normal") },
          { key: "created_at", label: "Posted", render: (row) => formatDate(row.created_at) },
        ],
        filename: "jobs-report.csv",
      };
    case "applications":
      return {
        title: "Applications Export",
        fetcher: () => adminAPI.getApplications(),
        columns: [
          { key: "id", label: "Application ID" },
          { key: "job_title", label: "Job Title" },
          { key: "worker_name", label: "Worker" },
          { key: "employer_name", label: "Employer" },
          { key: "status", label: "Status" },
          { key: "applied_at", label: "Applied", render: (row) => formatDate(row.applied_at) },
        ],
        filename: "applications-report.csv",
      };
    case "transactions":
      return {
        title: "Transactions Export",
        fetcher: () => adminAPI.getTransactions(),
        columns: [
          { key: "job_title", label: "Job" },
          { key: "employer_name", label: "Employer" },
          { key: "worker_name", label: "Worker" },
          { key: "gross_amount_npr", label: "Gross (NPR)", render: (row) => Number(row.gross_amount_npr || 0).toLocaleString() },
          { key: "gateway", label: "Gateway" },
          { key: "status", label: "Status" },
          { key: "initiated_at", label: "Initiated", render: (row) => formatDate(row.initiated_at) },
        ],
        filename: "transactions-report.csv",
      };
    case "reviews":
      return {
        title: "Reviews Export",
        fetcher: () => adminAPI.getReviews(),
        columns: [
          { key: "job_title", label: "Job" },
          { key: "reviewer_name", label: "Reviewer" },
          { key: "reviewee_name", label: "Reviewee" },
          { key: "reviewer_role", label: "Role" },
          { key: "overall_rating", label: "Rating" },
          { key: "created_at", label: "Created", render: (row) => formatDate(row.created_at) },
        ],
        filename: "reviews-report.csv",
      };
    case "reports":
    default:
      return {
        title: "Reports Export",
        fetcher: () => adminAPI.getReports(),
        columns: [
          { key: "reporter_id", label: "Reporter ID" },
          { key: "reported_id", label: "Reported ID" },
          { key: "reason", label: "Reason" },
          { key: "status", label: "Status" },
          { key: "created_at", label: "Created", render: (row) => formatDate(row.created_at) },
        ],
        filename: "reports-export.csv",
      };
  }
}

export default function Reports() {
  const [reportType, setReportType] = useState("workers");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const config = useMemo(() => datasetConfig(reportType), [reportType]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await config.fetcher();
        setRows(res.data || []);
      } catch (err) {
        console.error(err);
        setError("Failed to load report data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [config]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const query = search.toLowerCase();
    return rows.filter((row) =>
      Object.values(row || {}).some((value) => String(value ?? "").toLowerCase().includes(query))
    );
  }, [rows, search]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [reportType, search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleDownload = () => {
    const csvRows = [
      config.columns.map((column) => column.label),
      ...filteredRows.map((row) =>
        config.columns.map((column) => (column.render ? column.render(row) : row[column.key]))
      ),
    ];
    downloadCsv(config.filename, csvRows);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Data Reports</h1>
            <p className="mt-2 text-sm text-slate-600">
              Filter overall platform data by category, preview the records, and download the current view as CSV.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            disabled={loading || filteredRows.length === 0}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Download Current Data
          </button>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {REPORT_TYPES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setReportType(item.key)}
              className={`rounded-2xl border px-4 py-4 text-left shadow-sm transition ${
                reportType === item.key
                  ? "border-primary-300 bg-primary-50 text-primary-800"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              <p className="text-sm font-semibold">{item.label}</p>
            </button>
          ))}
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{config.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{filteredRows.length} record{filteredRows.length === 1 ? "" : "s"} in current view</p>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search current data..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-primary-400 focus:bg-white lg:max-w-sm"
            />
          </div>
        </div>

        {error && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
            <p className="text-sm font-medium text-slate-600">Loading report data...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-800">No data found</p>
            <p className="mt-2 text-sm text-slate-500">Try a different category or search term.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border-2 border-slate-300 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-center">
                <thead className="bg-slate-50">
                  <tr>
                    {config.columns.map((column, index) => (
                      <th
                        key={column.key}
                        className={`px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500 ${
                          index !== config.columns.length - 1 ? "border-r-2 border-slate-300" : ""
                        }`}
                        style={{ borderBottom: "1px solid #cbd5e1" }}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row, index) => (
                    <tr key={row.id || index} className="border-t border-slate-100">
                      {config.columns.map((column, columnIndex) => (
                        <td
                          key={column.key}
                          className={`px-5 py-4 text-center text-sm text-slate-700 ${
                            columnIndex !== config.columns.length - 1 ? "border-r-2 border-slate-200" : ""
                          }`}
                          style={{ borderBottom: "1px solid #e2e8f0" }}
                        >
                          {column.render ? column.render(row) : String(row[column.key] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls
              page={page}
              totalPages={totalPages}
              totalItems={filteredRows.length}
              pageSize={paginatedRows.length}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
