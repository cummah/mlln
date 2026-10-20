'use client';

import { useState } from 'react';
import Link from 'next/link';

interface SignupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SignupModal({ isOpen, onClose }: SignupModalProps) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVerification, setShowVerification] = useState(false);

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
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          display_name: displayName
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Signup failed');
        return;
      }

      // Show verification message
      setShowVerification(true);
      setDisplayName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--surface)',
        borderRadius: '12px',
        padding: '32px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
      }}>
        <div style={{
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '700',
            color: 'var(--text)',
            margin: '0 0 8px 0'
          }}>
            {showVerification ? 'Verify your email' : 'Get Started'}
          </h2>
          <p style={{
            fontSize: '14px',
            color: 'var(--text-2)',
            margin: 0
          }}>
            {showVerification ? 'Check your inbox for a verification link' : 'Create your account to get started'}
          </p>
        </div>

        {showVerification ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{
              padding: '16px',
              borderRadius: '8px',
              background: 'rgba(0, 200, 180, 0.1)',
              color: 'var(--teal)',
              border: '1px solid rgba(0, 200, 180, 0.3)',
              fontSize: '14px',
              lineHeight: '1.6'
            }}>
              <strong>Account created!</strong> We've sent a verification link to <strong>{email}</strong>. Click it to activate your account, then you can choose your plan.
            </div>
            <button
              onClick={onClose}
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--teal)',
                color: 'var(--bg)',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              Got it, close
            </button>
          </div>
        ) : (
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
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: '14px',
                fontFamily: 'inherit',
                opacity: loading ? 0.6 : 1
              }}
            />
            <input
              type="password"
              placeholder="password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
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
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: '14px',
                fontFamily: 'inherit',
                opacity: loading ? 0.6 : 1
              }}
            />

            <button
              type="submit"
              disabled={loading || !email || !password || !confirmPassword}
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--teal)',
                color: 'var(--bg)',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading || !email || !password || !confirmPassword ? 'not-allowed' : 'pointer',
                opacity: loading || !email || !password || !confirmPassword ? 0.6 : 1,
                transition: 'all 0.2s'
              }}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text)',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'all 0.2s'
              }}
            >
              Cancel
            </button>

            <div style={{
              textAlign: 'center',
              fontSize: '13px',
              color: 'var(--text-2)'
            }}>
              Already have an account?{' '}
              <Link href="/login" style={{
                color: 'var(--teal)',
                textDecoration: 'none',
                fontWeight: '600'
              }}>
                Login
              </Link>
            </div>

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
        )}
      </div>
    </div>
  );
}
