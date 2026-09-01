import React, { useEffect, useState, useRef } from 'react';
import API, { adminAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import KpiCard from '../../components/admin/KpiCard';
import LiveChart from '../../components/admin/LiveChart';

export default function Dashboard() {
  const { token } = useAuth();
  const [overviewStats, setOverviewStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await adminAPI.getKpiStats();
      setOverviewStats(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);



  if (loading) return <div style={{ padding: 20 }}>Loading Dashboard...</div>;
  if (!overviewStats) return <div style={{ padding: 20 }}>Failed to load stats.</div>;

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h2 style={{ margin: 0, fontSize: '24px', color: '#111827' }}>Admin Overview</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
        <KpiCard title="Total Users" value={overviewStats.total_users ?? 0} color="#3b82f6" icon="👷" />
        <KpiCard title="Total Reports" value={overviewStats.total_reports ?? 0} color="#8b5cf6" icon="🏢" />
        <KpiCard title="Pending Reports" value={overviewStats.pending_reports ?? 0} color="#ef4444" icon="⏳" />
      </div>


      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <LiveChart type="user_growth" title="User Growth Over Time" chartType="line" />
        <LiveChart type="job_postings" title="Job Postings Over Time" chartType="bar" />
        <LiveChart type="applications" title="Applications Submitted" chartType="line" />
        <LiveChart type="job_status" title="Job Status Breakdown" chartType="pie" />
        <LiveChart type="revenue" title="Revenue (eSewa vs Khalti)" chartType="bar" />
        <LiveChart type="active_users" title="Active Users Trend" chartType="area" />
      </div>
    </div>
  );
}
