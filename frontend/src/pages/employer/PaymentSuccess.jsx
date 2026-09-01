import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { paymentsAPI } from '../../api';

export default function PaymentSuccess() {
  const [status, setStatus] = useState('Verifying payment...');
  const [detail, setDetail] = useState('Please wait while we confirm the gateway response.');
  const [verified, setVerified] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const data = searchParams.get('data');
    const pidx = searchParams.get('pidx');

    const verify = async () => {
      try {
        if (data) {
          const res = await paymentsAPI.verifyEsewa({ data });
          setVerified(true);
          setStatus('Payment Verified');
          setDetail(res.data?.message || 'eSewa payment has been verified and released.');
          return;
        }

        if (pidx) {
          const res = await paymentsAPI.verifyKhalti({
            pidx,
            purchase_order_id: searchParams.get('purchase_order_id') || null,
          });
          setVerified(true);
          setStatus('Payment Verified');
          setDetail(res.data?.message || 'Khalti payment has been verified and released.');
          return;
        }

        setStatus('Payment Verification Required');
        setDetail('The gateway did not return verification data. Please check payment history or try again.');
      } catch (err) {
        setVerified(false);
        setStatus('Payment Verification Failed');
        setDetail(err?.response?.data?.detail || 'Could not verify this payment with the gateway.');
      }
    };

    verify();
  }, [location]);

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '40px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>{verified ? 'OK' : '...'}</div>
      <h2 style={{ color: verified ? '#166534' : '#92400e', marginTop: 0 }}>{status}</h2>
      <p style={{ color: '#4b5563', marginBottom: '24px' }}>{detail}</p>
      <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#4f46e5', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
        Return to Dashboard
      </button>
    </div>
  );
}
