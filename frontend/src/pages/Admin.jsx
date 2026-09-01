import { useEffect, useState } from "react";
import { adminAPI } from "../api";

export default function Admin() {
  const [tab, setTab] = useState("dashboard");
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (tab === "dashboard") {
          const res = await adminAPI.getStats();
          setStats(res.data);
        } else if (tab === "users") {
          const res = await adminAPI.getAllUsers();
          setUsers(res.data);
        } else {
          const res = await adminAPI.getReports();
          setReports(res.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tab]);

  const handleDeleteUser = async (userId) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    setActionLoading(userId);
    try {
      await adminAPI.deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReportStatus = async (reportId, status) => {
    setActionLoading(reportId);
    try {
      await adminAPI.updateReport(reportId, status);
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status } : r))
      );
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update report");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!confirm("Delete this report?")) return;
    setActionLoading(reportId);
    try {
      await adminAPI.deleteReport(reportId);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete report");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Admin Panel</h1>
        <p className="subtitle">Manage users and reports</p>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "dashboard" ? "active" : ""}`} onClick={() => setTab("dashboard")}>
          📊 Dashboard
        </button>
        <button className={`tab ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>
          👥 Users
        </button>
        <button className={`tab ${tab === "reports" ? "active" : ""}`} onClick={() => setTab("reports")}>
          🚩 Reports
        </button>
      </div>

      {loading ? (
        <div className="page-loader"><div className="spinner" /><p>Loading...</p></div>
      ) : tab === "dashboard" && stats ? (
        <div className="dashboard-stats" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', padding: '20px'}}>
          <div className="stat-card" style={{padding: '20px', backgroundColor: '#ffffff', borderRadius: '10px', textAlign: 'center', boxShadow: '0 6px 18px rgba(16,24,40,0.06)', border: '1px solid #eef2ff'}}>
            <h3>Total Workers</h3>
            <p style={{fontSize: '32px', color: '#1fa855', fontWeight: 'bold'}}>{stats.workers}</p>
          </div>
          <div className="stat-card" style={{padding: '20px', backgroundColor: '#ffffff', borderRadius: '10px', textAlign: 'center', boxShadow: '0 6px 18px rgba(16,24,40,0.06)', border: '1px solid #eef2ff'}}>
            <h3>Total Employers</h3>
            <p style={{fontSize: '32px', color: '#00a884', fontWeight: 'bold'}}>{stats.employers}</p>
          </div>
          <div className="stat-card" style={{padding: '20px', backgroundColor: '#ffffff', borderRadius: '10px', textAlign: 'center', boxShadow: '0 6px 18px rgba(16,24,40,0.06)', border: '1px solid #eef2ff'}}>
            <h3>Active Jobs</h3>
            <p style={{fontSize: '32px', color: '#53bdeb', fontWeight: 'bold'}}>{stats.jobs}</p>
          </div>
          <div className="stat-card" style={{padding: '20px', backgroundColor: '#ffffff', borderRadius: '10px', textAlign: 'center', boxShadow: '0 6px 18px rgba(16,24,40,0.06)', border: '1px solid #eef2ff'}}>
            <h3>Applications</h3>
            <p style={{fontSize: '32px', color: '#ffb02e', fontWeight: 'bold'}}>{stats.applications}</p>
          </div>
        </div>
      ) : tab === "users" ? (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>#{u.id}</td>
                  <td style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a', fontWeight: 600 }}>
                      {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontWeight: 600 }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{u.role}</div>
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`status-badge status-${u.role}`}>{u.role}</span>
                  </td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDeleteUser(u.id)}
                      disabled={actionLoading === u.id}
                    >
                      {actionLoading === u.id ? "..." : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-container">
          {reports.length === 0 ? (
            <div className="empty-state"><p>No reports</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Reporter</th>
                  <th>Reported</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td>#{r.id}</td>
                    <td>User #{r.reporter_id}</td>
                    <td>User #{r.reported_id}</td>
                    <td>{r.reason.substring(0, 50)}...</td>
                    <td>
                      <span className={`status-badge status-${r.status}`}>{r.status}</span>
                    </td>
                    <td>{new Date(r.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="btn-group">
                        {r.status === "pending" && (
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => handleReportStatus(r.id, "resolved")}
                            disabled={actionLoading === r.id}
                          >
                            Resolve
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeleteReport(r.id)}
                          disabled={actionLoading === r.id}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
