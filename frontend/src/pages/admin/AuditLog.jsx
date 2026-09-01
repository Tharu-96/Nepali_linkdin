import React, { useEffect, useMemo, useState } from "react";
import { adminAPI } from "../../api";
import PaginationControls from "../../components/admin/PaginationControls";

const ROLE_FILTERS = [
  { key: "all", label: "All Logs" },
  { key: "employer", label: "Employer Logs" },
  { key: "worker", label: "Worker Logs" },
];

function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

export default function AuditLog() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await adminAPI.getAuditLogs();
        setRows(res.data || []);
      } catch (err) {
        console.error(err);
        setError("Failed to load audit logs");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredRows = useMemo(() => {
    let result = rows;

    if (roleFilter !== "all") {
      result = result.filter((row) => row.actor_role === roleFilter);
    }

    if (!search.trim()) return result;
    const query = search.toLowerCase();
    return result.filter((row) =>
      [row.actor_name, row.actor_role, row.action, row.entity_type, row.entity_label, row.details]
        .some((value) => String(value ?? "").toLowerCase().includes(query))
    );
  }, [rows, roleFilter, search]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [roleFilter, search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Audit Log</h1>
            <p className="mt-2 text-sm text-slate-600">
              Review employer and worker activity across registrations, jobs, applications, reviews, payments, and reports.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Total Logs</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{filteredRows.length}</p>
          </div>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {ROLE_FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setRoleFilter(item.key)}
              className={`rounded-2xl border px-4 py-4 text-center shadow-sm transition ${
                roleFilter === item.key
                  ? "border-primary-300 bg-primary-50 text-primary-800"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              <p className="text-sm font-semibold">{item.label}</p>
            </button>
          ))}
        </div>

        <div className="mb-6 rounded-2xl border-2 border-slate-300 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Activity Timeline</h2>
              <p className="mt-1 text-sm text-slate-500">
                Showing {filteredRows.length} audit record{filteredRows.length === 1 ? "" : "s"}
              </p>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-4 py-3 text-sm text-center outline-none transition focus:border-primary-400 focus:bg-white lg:max-w-sm"
            />
          </div>
        </div>

        {error && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border-2 border-slate-300 bg-white shadow-sm">
            <p className="text-sm font-medium text-slate-600">Loading audit logs...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-800">No audit logs found</p>
            <p className="mt-2 text-sm text-slate-500">Try a different filter or search term.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border-2 border-slate-400 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-center">
                <thead className="bg-slate-50">
                  <tr>
                    {["Actor", "Role", "Action", "Entity", "Details", "Date & Time"].map((label, index, array) => (
                      <th
                        key={label}
                        className={`px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500 ${
                          index !== array.length - 1 ? "border-r-2 border-slate-400" : ""
                        }`}
                        style={{ borderBottom: "2px solid #94a3b8" }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row) => (
                    <tr key={row.id}>
                      <td className="border-r-2 border-slate-300 px-5 py-4 text-center text-sm font-semibold text-slate-800" style={{ borderBottom: "1px solid #cbd5e1" }}>
                        {row.actor_name}
                      </td>
                      <td className="border-r-2 border-slate-300 px-5 py-4 text-center text-sm text-slate-700 capitalize" style={{ borderBottom: "1px solid #cbd5e1" }}>
                        {row.actor_role}
                      </td>
                      <td className="border-r-2 border-slate-300 px-5 py-4 text-center text-sm text-slate-700" style={{ borderBottom: "1px solid #cbd5e1" }}>
                        {row.action}
                      </td>
                      <td className="border-r-2 border-slate-300 px-5 py-4 text-center text-sm text-slate-700" style={{ borderBottom: "1px solid #cbd5e1" }}>
                        <div className="font-semibold text-slate-800">{row.entity_type}</div>
                        <div className="text-xs text-slate-500">{row.entity_label}</div>
                      </td>
                      <td className="border-r-2 border-slate-300 px-5 py-4 text-center text-sm text-slate-700" style={{ borderBottom: "1px solid #cbd5e1" }}>
                        {row.details || "-"}
                      </td>
                      <td className="px-5 py-4 text-center text-sm text-slate-700" style={{ borderBottom: "1px solid #cbd5e1" }}>
                        {formatDateTime(row.created_at)}
                      </td>
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
