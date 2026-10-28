'use client';

import { useState } from 'react';

export default function PasswordResetForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to send reset link');
      } else {
        setSent(true);
        setEmail('');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div style={{
        padding: '24px',
        borderRadius: '8px',
        background: 'rgba(0, 200, 180, 0.1)',
        border: '1px solid rgba(0, 200, 180, 0.3)',
        color: 'var(--teal)',
        fontSize: '14px'
      }}>
        <strong>Check your email!</strong> We've sent a password reset link to <strong>{email}</strong>. Click the link to create a new password.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <input
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={loading}
        style={{
          padding: '12px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--text)',
          fontSize: '14px',
          fontFamily: 'inherit',
          opacity: loading ? 0.6 : 1
        }}
      />

      <button
        type="submit"
        disabled={loading || !email}
        style={{
          padding: '12px',
          borderRadius: '8px',
          border: 'none',
          background: 'var(--teal)',
          color: 'var(--bg)',
          fontSize: '14px',
          fontWeight: '600',
          cursor: loading || !email ? 'not-allowed' : 'pointer',
          opacity: loading || !email ? 0.6 : 1,
          transition: 'all 0.2s'
        }}
      >
        {loading ? 'Sending...' : 'Send reset link'}
      </button>

      {error && (
        <div style={{
          padding: '12px',
          borderRadius: '8px',
          background: 'rgba(255, 0, 0, 0.1)',
          color: '#ff6b6b',
          fontSize: '14px',
          border: '1px solid rgba(255, 107, 107, 0.3)'
        }}>
          {error}
        </div>
      )}

      <p style={{
        textAlign: 'center',
        fontSize: '12px',
        color: 'var(--text-2)',
        marginTop: '8px'
      }}>
        Remember your password?{' '}
        <a href="/login" style={{
          color: 'var(--teal)',
          textDecoration: 'none',
          fontWeight: '600'
        }}>
          Sign in
        </a>
      </p>
    </form>
  );
}
