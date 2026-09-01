import React from 'react';

export default function CommissionBreakdown({ gross, commissionRate = 0.08 }) {
  const commission = gross * commissionRate;
  const employerTotal = gross + commission;

  return (
    <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb', marginTop: '16px' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#111827' }}>Payment Breakdown</h3>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#4b5563' }}>
        <span>Worker payment:</span>
        <span style={{ fontWeight: 500 }}>{gross.toLocaleString()}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#ef4444' }}>
        <span>Rozgar platform fee ({(commissionRate * 100).toFixed(0)}%):</span>
        <span style={{ fontWeight: 500 }}>+ {commission.toLocaleString()}</span>
      </div>
      <hr style={{ border: 'none', borderTop: '1px solid #d1d5db', margin: '12px 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981', fontSize: '18px', fontWeight: 'bold' }}>
        <span>Total you will pay:</span>
        <span>{employerTotal.toLocaleString()}</span>
      </div>
      <p style={{ margin: '12px 0 0', color: '#166534', fontSize: '13px' }}>
        The worker receives the full {gross.toLocaleString()} NPR. The platform fee is paid separately by you.
      </p>
    </div>
  );
}
