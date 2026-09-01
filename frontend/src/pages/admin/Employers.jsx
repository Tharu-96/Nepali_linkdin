import React, { useEffect, useMemo, useState } from 'react';
import { adminAPI } from '../../api';
import PaginationControls from '../../components/admin/PaginationControls';

export default function Employers() {
  const [employers, setEmployers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const downloadCsv = () => {
    const rows = [
      ["Company", "Email", "National ID Card", "Jobs Posted", "Revenue (NPR)", "Status"],
      ...employers.map((e) => [
        e.company_name,
        e.email,
        e.national_id_card || "Not available",
        e.total_jobs_posted,
        e.total_revenue_paid,
        e.is_active ? "Active" : "Suspended",
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "employers-records.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchEmployers();
  }, []);

  const paginatedEmployers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return employers.slice(start, start + pageSize);
  }, [employers, page]);

  const totalPages = Math.max(1, Math.ceil(employers.length / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const fetchEmployers = async () => {
    try {
      const res = await adminAPI.getEmployers();
      setEmployers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteEmployer = async (employer) => {
    if (!window.confirm(`Delete ${employer.company_name}? This cannot be undone.`)) return;
    try {
      await adminAPI.deleteUser(employer.id);
      setEmployers(employers.filter((e) => e.id !== employer.id));
    } catch (err) {
      alert('Failed to delete user');
    }
  };

  const toggleStatus = async (employer) => {
    try {
      await adminAPI.updateUserStatus(employer.id, !employer.is_active);
      setEmployers(employers.map(e => e.id === employer.id ? { ...e, is_active: !e.is_active } : e));
    } catch (err) {
      alert('Failed to update status');
    }
  };

  if (loading) return <div style={{ padding: 20 }}>Loading Employers...</div>;

  return (
    <div style={{ padding: '20px' }}>
      <style>{`
        .admin-employers-table th:not(:last-child),
        .admin-employers-table td:not(:last-child) {
          border-right: 2px solid #cbd5e1;
        }
        .admin-employers-table th:not(:last-child) {
          border-right-color: #94a3b8;
        }
        .admin-employers-table th {
          border-bottom: 2px solid #94a3b8;
        }
        .admin-employers-table td {
          border-bottom: 1px solid #cbd5e1;
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Manage Employers</h2>
        <button onClick={downloadCsv} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#fff', cursor: 'pointer', fontWeight: 500 }}>
          Download Records
        </button>
      </div>
      <div style={{ backgroundColor: '#fff', borderRadius: '16px', overflowX: 'auto', border: '2px solid #94a3b8' }}>
        <table className="admin-employers-table" style={{ width: '100%', minWidth: '1000px', borderCollapse: 'separate', borderSpacing: 0, textAlign: 'left' }}>
          <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            <tr>
              <th style={{ padding: '12px 16px', color: '#6b7280', fontSize: '14px' }}>Company</th>
              <th style={{ padding: '12px 16px', color: '#6b7280', fontSize: '14px' }}>Email</th>
              <th style={{ padding: '12px 16px', color: '#6b7280', fontSize: '14px' }}>National ID Card</th>
              <th style={{ padding: '12px 16px', color: '#6b7280', fontSize: '14px', textAlign: 'center' }}>Jobs Posted</th>
              <th style={{ padding: '12px 16px', color: '#6b7280', fontSize: '14px', textAlign: 'center' }}>Revenue (NPR)</th>
              <th style={{ padding: '12px 16px', color: '#6b7280', fontSize: '14px' }}>Status</th>
              <th style={{ padding: '12px 16px', color: '#6b7280', fontSize: '14px', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedEmployers.map(e => (
              <tr key={e.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{e.company_name}</td>
                <td style={{ padding: '12px 16px', color: '#4b5563' }}>{e.email}</td>
                <td style={{ padding: '12px 16px', color: '#4b5563' }}>{e.national_id_card || 'Not available'}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>{e.total_jobs_posted}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>{e.total_revenue_paid.toLocaleString()}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    padding: '4px 8px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                    backgroundColor: e.is_active ? '#dcfce7' : '#fee2e2',
                    color: e.is_active ? '#166534' : '#991b1b'
                  }}>
                    {e.is_active ? 'Active' : 'Suspended'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
                    <button
                      onClick={() => toggleStatus(e)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '32px',
                        padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                        backgroundColor: e.is_active ? '#ef4444' : '#10b981', color: '#fff', fontWeight: 500
                      }}
                    >
                      {e.is_active ? 'Suspend' : 'Reactivate'}
                    </button>
                    <a
                      href={`/admin/users/${e.id}`}
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '32px', padding: '6px 10px', boxSizing: 'border-box', border: '1px solid #bfdbfe', borderRadius: '6px', backgroundColor: '#eff6ff', color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}
                    >
                      Edit
                    </a>
                    <button
                      onClick={() => deleteEmployer(e)}
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
          totalItems={employers.length}
          pageSize={paginatedEmployers.length}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
