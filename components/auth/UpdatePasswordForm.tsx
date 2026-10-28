'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { useRouter } from 'next/navigation';

export default function UpdatePasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
      } else {
        router.push('/account?passwordUpdated=true');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <input
        type="password"
        placeholder="new password (min 6 characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
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
      <input
        type="password"
        placeholder="confirm password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
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
        disabled={loading || !password || !confirmPassword}
        style={{
          padding: '12px',
          borderRadius: '8px',
          border: 'none',
          background: 'var(--teal)',
          color: 'var(--bg)',
          fontSize: '14px',
          fontWeight: '600',
          cursor: loading || !password || !confirmPassword ? 'not-allowed' : 'pointer',
          opacity: loading || !password || !confirmPassword ? 0.6 : 1,
          transition: 'all 0.2s'
        }}
      >
        {loading ? 'Updating...' : 'Update password'}
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
    </form>
  );
}
