import React, { useEffect, useMemo, useState } from "react";
import { adminAPI } from "../../api";
import PaginationControls from "../../components/admin/PaginationControls";

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [editingJob, setEditingJob] = useState(null);
  const [saving, setSaving] = useState(false);
  const pageSize = 10;

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        setLoading(true);
        const res = await adminAPI.getJobs();
        setJobs(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, []);

  const paginatedJobs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return jobs.slice(start, start + pageSize);
  }, [jobs, page]);

  const totalPages = Math.max(1, Math.ceil(jobs.length / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleEditClick = (job) => {
    setEditingJob({
      ...job,
      required_skills: job.required_skills || "",
      status: job.status || "open",
    });
  };

  const handleSaveJob = async (e) => {
    e.preventDefault();
    if (!editingJob) return;
    setSaving(true);
    try {
      const payload = {
        title: editingJob.title,
        description: editingJob.description,
        location: editingJob.location,
        salary: editingJob.salary,
        required_skills: editingJob.required_skills || null,
        is_urgent: Boolean(editingJob.is_urgent),
        status: editingJob.status || "open",
      };
      const res = await adminAPI.updateJob(editingJob.id, payload);
      setJobs((current) => current.map((job) => (job.id === editingJob.id ? res.data : job)));
      setEditingJob(null);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update job");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteJob = async (job) => {
    const confirmed = window.confirm(`Delete job "${job.title}"?`);
    if (!confirmed) return;
    try {
      await adminAPI.deleteJob(job.id);
      setJobs((current) => current.filter((item) => item.id !== job.id));
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete job");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2 style={{ margin: "0 0 20px", color: "#111827" }}>Jobs</h2>

      {loading ? (
        <div style={{ padding: 20 }}>Loading Jobs...</div>
      ) : (
        <div style={{ backgroundColor: "#fff", borderRadius: "8px", overflow: "hidden", border: "1px solid #eef2ff" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center" }}>
            <thead style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              <tr>
                <th style={{ padding: "12px 16px", color: "#6b7280", fontSize: "14px", borderRight: "1px solid #e5e7eb", textAlign: "center" }}>Title</th>
                <th style={{ padding: "12px 16px", color: "#6b7280", fontSize: "14px", borderRight: "1px solid #e5e7eb", textAlign: "center" }}>Employer</th>
                <th style={{ padding: "12px 16px", color: "#6b7280", fontSize: "14px", borderRight: "1px solid #e5e7eb", textAlign: "center" }}>Posted</th>
                <th style={{ padding: "12px 16px", color: "#6b7280", fontSize: "14px", borderRight: "1px solid #e5e7eb", textAlign: "center" }}>Status</th>
                <th style={{ padding: "12px 16px", color: "#6b7280", fontSize: "14px", textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedJobs.map((job) => (
                <tr key={job.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 500, borderRight: "1px solid #e5e7eb", textAlign: "center" }}>{job.title}</td>
                  <td style={{ padding: "12px 16px", borderRight: "1px solid #e5e7eb", textAlign: "center" }}>{job.employer_name}</td>
                  <td style={{ padding: "12px 16px", color: "#4b5563", borderRight: "1px solid #e5e7eb", textAlign: "center" }}>
                    {job.created_at ? new Date(job.created_at).toLocaleDateString() : ""}
                  </td>
                  <td style={{ padding: "12px 16px", borderRight: "1px solid #e5e7eb", textAlign: "center" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 8px",
                        borderRadius: "999px",
                        fontSize: "12px",
                        fontWeight: 600,
                        backgroundColor: job.is_urgent ? "#fee2e2" : "#e0f2fe",
                        color: job.is_urgent ? "#991b1b" : "#075985",
                      }}
                    >
                      {job.is_urgent ? "Urgent" : "Normal"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                      <button
                        type="button"
                        onClick={() => handleEditClick(job)}
                        style={{ border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: "8px", padding: "6px 10px", fontWeight: 600, cursor: "pointer" }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteJob(job)}
                        style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", borderRadius: "8px", padding: "6px 10px", fontWeight: 600, cursor: "pointer" }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationControls
            page={page}
            totalPages={totalPages}
            totalItems={jobs.length}
            pageSize={paginatedJobs.length}
            onPageChange={setPage}
          />
        </div>
      )}

      {editingJob && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", zIndex: 50 }}>
          <form onSubmit={handleSaveJob} style={{ width: "min(92vw, 680px)", maxHeight: "90vh", overflowY: "auto", background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 24px 60px rgba(0,0,0,0.25)", padding: "24px" }}>
            <h3 style={{ margin: "0 0 18px", fontSize: "20px", color: "#111827" }}>Edit Job</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <label style={{ display: "grid", gap: "6px", fontWeight: 600, color: "#374151" }}>
                Title
                <input value={editingJob.title || ""} onChange={(e) => setEditingJob({ ...editingJob, title: e.target.value })} required style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: "8px" }} />
              </label>
              <label style={{ display: "grid", gap: "6px", fontWeight: 600, color: "#374151" }}>
                Location
                <input value={editingJob.location || ""} onChange={(e) => setEditingJob({ ...editingJob, location: e.target.value })} required style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: "8px" }} />
              </label>
              <label style={{ display: "grid", gap: "6px", fontWeight: 600, color: "#374151" }}>
                Estimated Salary
                <input value={editingJob.salary || ""} onChange={(e) => setEditingJob({ ...editingJob, salary: e.target.value })} required style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: "8px" }} />
              </label>
              <label style={{ display: "grid", gap: "6px", fontWeight: 600, color: "#374151" }}>
                Status
                <select value={editingJob.status || "open"} onChange={(e) => setEditingJob({ ...editingJob, status: e.target.value })} style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: "8px" }}>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="paid">Paid</option>
                </select>
              </label>
              <label style={{ gridColumn: "1 / -1", display: "grid", gap: "6px", fontWeight: 600, color: "#374151" }}>
                Required Skills
                <input value={editingJob.required_skills || ""} onChange={(e) => setEditingJob({ ...editingJob, required_skills: e.target.value })} style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: "8px" }} />
              </label>
              <label style={{ gridColumn: "1 / -1", display: "grid", gap: "6px", fontWeight: 600, color: "#374151" }}>
                Description
                <textarea value={editingJob.description || ""} onChange={(e) => setEditingJob({ ...editingJob, description: e.target.value })} required rows={5} style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: "8px", resize: "vertical" }} />
              </label>
              <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, color: "#374151" }}>
                <input type="checkbox" checked={Boolean(editingJob.is_urgent)} onChange={(e) => setEditingJob({ ...editingJob, is_urgent: e.target.checked })} />
                Mark as urgent
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "22px" }}>
              <button type="button" onClick={() => setEditingJob(null)} disabled={saving} style={{ border: "1px solid #d1d5db", background: "#fff", color: "#374151", borderRadius: "8px", padding: "10px 16px", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ border: "none", background: "#2563eb", color: "#fff", borderRadius: "8px", padding: "10px 18px", fontWeight: 700, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving..." : "Save Job"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
