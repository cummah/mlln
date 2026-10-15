'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message === 'Invalid login credentials') {
          setError('Invalid email or password');
        } else {
          setError(error.message);
        }
      } else {
        router.push('/account');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
      } else {
        setMessage('Check your email for the magic link!');
        setEmail('');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px'
    }}>
      <form onSubmit={handleEmailPassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
          {loading ? 'Signing in...' : 'Sign in with password'}
        </button>
      </form>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: 'var(--text-3)',
        fontSize: '12px'
      }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        OR
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </div>

      <button
        onClick={handleMagicLink}
        disabled={loading || !email}
        style={{
          padding: '12px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          background: 'transparent',
          color: 'var(--teal)',
          fontSize: '14px',
          fontWeight: '600',
          cursor: loading || !email ? 'not-allowed' : 'pointer',
          opacity: loading || !email ? 0.6 : 1,
          transition: 'all 0.2s'
        }}
      >
        {loading ? 'Sending...' : 'Send magic link'}
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

      {message && (
        <div style={{
          padding: '12px',
          borderRadius: '8px',
          background: 'rgba(0, 200, 180, 0.1)',
          color: 'var(--teal)',
          fontSize: '14px',
          border: '1px solid rgba(0, 200, 180, 0.3)'
        }}>
          {message}
        </div>
      )}

      <p style={{
        textAlign: 'center',
        fontSize: '12px',
        color: 'var(--text-2)',
        marginTop: '8px'
      }}>
        Don't have an account?{' '}
        <a href="/signup" style={{
          color: 'var(--teal)',
          textDecoration: 'none',
          fontWeight: '600'
        }}>
          Sign up
        </a>
      </p>
    </div>
  );
}
