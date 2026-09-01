import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { jobsAPI, paymentsAPI } from '../../api';
import CommissionBreakdown from '../../components/payments/CommissionBreakdown';
import { continueToPaymentGateway } from '../../services/paymentGateway';

export default function PayWorker() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gateway, setGateway] = useState('esewa');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const res = await jobsAPI.getJob(jobId);
        setJob(res.data);
      } catch (err) {
        alert('Job not found');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchJob();
  }, [jobId, navigate]);

  const handlePay = async () => {
    setProcessing(true);
    try {
      if (gateway === 'esewa') {
        const res = await paymentsAPI.initiatePayment({ job_id: parseInt(jobId), gateway: 'esewa' });
        continueToPaymentGateway(res.data);
      } else {
        const res = await paymentsAPI.initiateKhaltiPayment({ job_id: parseInt(jobId), gateway: 'khalti' });
        continueToPaymentGateway(res.data);
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to initiate payment');
      setProcessing(false);
    }
  };

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '24px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <h2 style={{ color: '#111827', marginTop: 0 }}>Pay Worker</h2>
      <p style={{ color: '#4b5563' }}>You are initiating payment for the completed job: <strong>{job.title}</strong></p>
      
      <CommissionBreakdown gross={Number(String(job.salary || "").replace(/,/g, "").match(/\d+(?:\.\d+)?/)?.[0] || 0)} commissionRate={0.08} />
      
      <h3 style={{ marginTop: '24px', marginBottom: '12px', color: '#111827' }}>Select Payment Method</h3>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <label style={{ flex: 1, border: `2px solid ${gateway === 'esewa' ? '#10b981' : '#e5e7eb'}`, borderRadius: '8px', padding: '16px', cursor: 'pointer', textAlign: 'center', backgroundColor: gateway === 'esewa' ? '#ecfdf5' : '#fff' }}>
          <input type="radio" name="gateway" value="esewa" checked={gateway === 'esewa'} onChange={(e) => setGateway(e.target.value)} style={{ display: 'none' }} />
          <div style={{ fontWeight: 600, color: gateway === 'esewa' ? '#065f46' : '#4b5563' }}>eSewa</div>
        </label>
        <label style={{ flex: 1, border: `2px solid ${gateway === 'khalti' ? '#4f46e5' : '#e5e7eb'}`, borderRadius: '8px', padding: '16px', cursor: 'pointer', textAlign: 'center', backgroundColor: gateway === 'khalti' ? '#eef2ff' : '#fff' }}>
          <input type="radio" name="gateway" value="khalti" checked={gateway === 'khalti'} onChange={(e) => setGateway(e.target.value)} style={{ display: 'none' }} />
          <div style={{ fontWeight: 600, color: gateway === 'khalti' ? '#3730a3' : '#4b5563' }}>Khalti</div>
        </label>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button onClick={() => navigate(-1)} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 500, flex: 1 }}>
          Cancel
        </button>
        <button onClick={handlePay} disabled={processing} style={{ padding: '12px', borderRadius: '8px', border: 'none', background: gateway === 'esewa' ? '#10b981' : '#4f46e5', color: '#fff', cursor: 'pointer', fontWeight: 500, flex: 2, opacity: processing ? 0.7 : 1 }}>
          {processing ? 'Redirecting...' : `Pay total with ${gateway === 'esewa' ? 'eSewa' : 'Khalti'}`}
        </button>
      </div>
    </div>
  );
}
