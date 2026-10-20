'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface PaymentStatusResponse {
  status: string;
  tier: number;
  message: string;
}

export default function PaymentSuccessContent({ user }: { user: any }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verifying your payment...');

  useEffect(() => {
    verifyPayment();
  }, [orderId]);

  const verifyPayment = async () => {
    if (!orderId) {
      setStatus('error');
      setMessage('No payment order found. Please contact support.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      });

      const data: PaymentStatusResponse = await response.json();

      if (!response.ok) {
        setStatus('error');
        setMessage(data.message || 'Payment verification failed');
        setLoading(false);
        return;
      }

      if (data.status === 'completed') {
        setStatus('success');
        setMessage(`Payment successful! Your account has been upgraded.`);
        // Redirect to account page after 3 seconds
        setTimeout(() => router.push('/account'), 3000);
      } else if (data.status === 'pending') {
        setStatus('verifying');
        setMessage('Payment is being processed. This may take a moment...');
        // Try again in 3 seconds
        setTimeout(verifyPayment, 3000);
      } else {
        setStatus('error');
        setMessage('Payment could not be verified. Please contact support.');
      }
    } catch (err) {
      console.error('Verification error:', err);
      setStatus('error');
      setMessage('An error occurred. Please contact support.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      padding: '40px 20px',
      maxWidth: '600px',
      margin: '0 auto',
      textAlign: 'center',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {status === 'success' && (
        <>
          <div style={{
            fontSize: '48px',
            marginBottom: '24px',
            color: 'var(--teal)'
          }}>
            ✓
          </div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: 'var(--text)',
            marginBottom: '12px'
          }}>
            Payment Successful!
          </h1>
          <p style={{
            fontSize: '16px',
            color: 'var(--text-2)',
            marginBottom: '24px'
          }}>
            {message}
          </p>
          <p style={{
            fontSize: '14px',
            color: 'var(--text-3)'
          }}>
            Redirecting to your account page...
          </p>
        </>
      )}

      {status === 'verifying' && (
        <>
          <div style={{
            fontSize: '40px',
            marginBottom: '24px',
            animation: 'spin 1s linear infinite'
          }}>
            ⏳
          </div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: 'var(--text)',
            marginBottom: '12px'
          }}>
            {message}
          </h1>
          <p style={{
            fontSize: '14px',
            color: 'var(--text-3)'
          }}>
            Please don't close this page while we verify your payment.
          </p>
          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </>
      )}

      {status === 'error' && (
        <>
          <div style={{
            fontSize: '48px',
            marginBottom: '24px',
            color: '#ff6b6b'
          }}>
            ✕
          </div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: 'var(--text)',
            marginBottom: '12px'
          }}>
            Payment Verification Failed
          </h1>
          <p style={{
            fontSize: '16px',
            color: 'var(--text-2)',
            marginBottom: '24px'
          }}>
            {message}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => verifyPayment()}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--teal)',
                color: 'var(--bg)',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Try Again
            </button>
            <a
              href="/account"
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text)',
                fontWeight: '600',
                fontSize: '14px',
                textDecoration: 'none'
              }}
            >
              Back to Account
            </a>
          </div>
        </>
      )}
    </div>
  );
}
