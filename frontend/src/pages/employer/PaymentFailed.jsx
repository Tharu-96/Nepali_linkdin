import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { paymentsAPI } from '../../api';

export default function PaymentFailed() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const transactionId = new URLSearchParams(location.search).get('transaction_id');
    if (transactionId) paymentsAPI.markPaymentFailed(transactionId).catch(() => {});
  }, [location.search]);

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '40px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
      <h2 style={{ color: '#991b1b', marginTop: 0 }}>Payment Cancelled or Failed</h2>
      <p style={{ color: '#4b5563', marginBottom: '24px' }}>The payment was not completed. If your wallet shows a charge, check Payment History before trying again.</p>
      <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#4f46e5', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
        Return to Dashboard
      </button>
    </div>
  );
}
