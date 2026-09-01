import React, { useEffect, useMemo, useState } from 'react';
import { adminAPI } from '../../api';
import PaginationControls from '../../components/admin/PaginationControls';

export default function Workers() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const downloadCsv = () => {
    const rows = [
        ["Name", "Email", "National ID Card", "Applications", "Rating", "Status"],
      ...workers.map((w) => [
        w.name,
        w.email,
        w.national_id_card || "Not available",
        w.total_applications,
        w.avg_rating.toFixed(1),
        w.is_active ? "Active" : "Suspended",
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "workers-records.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  const paginatedWorkers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return workers.slice(start, start + pageSize);
  }, [workers, page]);

  const totalPages = Math.max(1, Math.ceil(workers.length / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const fetchWorkers = async () => {
    try {
      const res = await adminAPI.getWorkers();
      setWorkers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteWorker = async (worker) => {
    if (!window.confirm(`Delete ${worker.name}? This cannot be undone.`)) return;
    try {
      await adminAPI.deleteUser(worker.id);
      setWorkers(workers.filter((w) => w.id !== worker.id));
    } catch (err) {
      alert('Failed to delete user');
    }
  };

  const toggleStatus = async (worker) => {
    try {
      await adminAPI.updateUserStatus(worker.id, !worker.is_active);
      setWorkers(workers.map(w => w.id === worker.id ? { ...w, is_active: !w.is_active } : w));
    } catch (err) {
      alert('Failed to update status');
    }
  };

  if (loading) return <div style={{ padding: 20 }}>Loading Workers...</div>;

  return (
    <div style={{ padding: '20px' }}>
      <style>{`
        .admin-workers-table th:not(:last-child),
        .admin-workers-table td:not(:last-child) {
          border-right: 2px solid #cbd5e1;
        }
        .admin-workers-table th:not(:last-child) {
          border-right-color: #94a3b8;
        }
        .admin-workers-table th {
          border-bottom: 2px solid #94a3b8;
        }
        .admin-workers-table td {
          border-bottom: 1px solid #cbd5e1;
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Manage Workers</h2>
        <button onClick={downloadCsv} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#fff', cursor: 'pointer', fontWeight: 500 }}>
          Download Records
        </button>
      </div>
      <div style={{ backgroundColor: '#fff', borderRadius: '16px', overflowX: 'auto', border: '2px solid #94a3b8' }}>
        <table className="admin-workers-table" style={{ width: '100%', minWidth: '940px', borderCollapse: 'separate', borderSpacing: 0, textAlign: 'left' }}>
          <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            <tr>
              <th style={{ padding: '12px 16px', color: '#6b7280', fontSize: '14px' }}>Name</th>
              <th style={{ padding: '12px 16px', color: '#6b7280', fontSize: '14px' }}>Email</th>
              <th style={{ padding: '12px 16px', color: '#6b7280', fontSize: '14px' }}>National ID Card</th>
              <th style={{ padding: '12px 16px', color: '#6b7280', fontSize: '14px', textAlign: 'center' }}>Applications</th>
              <th style={{ padding: '12px 16px', color: '#6b7280', fontSize: '14px' }}>Rating</th>
              <th style={{ padding: '12px 16px', color: '#6b7280', fontSize: '14px' }}>Status</th>
              <th style={{ padding: '12px 16px', color: '#6b7280', fontSize: '14px', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedWorkers.map(w => (
              <tr key={w.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{w.name}</td>
                <td style={{ padding: '12px 16px', color: '#4b5563' }}>{w.email}</td>
                <td style={{ padding: '12px 16px', color: '#4b5563' }}>{w.national_id_card || 'Not available'}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>{w.total_applications}</td>
                <td style={{ padding: '12px 16px' }}>{w.avg_rating.toFixed(1)}⭐</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ 
                    padding: '4px 8px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                    backgroundColor: w.is_active ? '#dcfce7' : '#fee2e2',
                    color: w.is_active ? '#166534' : '#991b1b'
                  }}>
                    {w.is_active ? 'Active' : 'Suspended'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
                    <button 
                      onClick={() => toggleStatus(w)}
                      style={{ 
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '32px',
                        padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                        backgroundColor: w.is_active ? '#ef4444' : '#10b981', color: '#fff', fontWeight: 500
                      }}
                    >
                      {w.is_active ? 'Suspend' : 'Reactivate'}
                    </button>
                    <a
                      href={`/admin/users/${w.id}`}
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '32px', padding: '6px 10px', boxSizing: 'border-box', border: '1px solid #bfdbfe', borderRadius: '6px', backgroundColor: '#eff6ff', color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}
                    >
                      Edit
                    </a>
                    <button
                      onClick={() => deleteWorker(w)}
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '32px', padding: '6px 10px', border: '1px solid #fecdd3', borderRadius: '6px', backgroundColor: '#fff1f2', color: '#e11d48', cursor: 'pointer', fontWeight: 500 }}
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
          totalItems={workers.length}
          pageSize={paginatedWorkers.length}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
