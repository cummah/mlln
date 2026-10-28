'use client';

import { useState } from 'react';
import TurnstileWidget from '@/components/auth/TurnstileWidget';

export function ContactForm() {
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!email.trim() || !subject.trim() || !message.trim()) {
      setError('All fields are required');
      return;
    }

    if (message.length > 5000) {
      setError('Message must be 5000 characters or less');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, subject, message, captchaToken }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setSuccess(true);
      setEmail('');
      setSubject('');
      setMessage('');
      setCaptchaToken('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: 'rgba(255, 107, 107, 0.1)',
            color: '#ff6b6b',
            border: '1px solid rgba(255, 107, 107, 0.3)',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: 'rgba(0, 200, 180, 0.1)',
            color: 'var(--teal)',
            border: '1px solid rgba(0, 200, 180, 0.3)',
            fontSize: '14px',
          }}
        >
          Thanks for reaching out! We'll get back to you soon.
        </div>
      )}

      <div>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: 'var(--text)', marginBottom: '6px' }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: '14px',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            opacity: loading ? 0.6 : 1,
          }}
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: 'var(--text)', marginBottom: '6px' }}>
          Subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: '14px',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            opacity: loading ? 0.6 : 1,
          }}
          placeholder="How can we help?"
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: 'var(--text)', marginBottom: '6px' }}>
          Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: '14px',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            minHeight: '160px',
            resize: 'vertical',
            opacity: loading ? 0.6 : 1,
          }}
          placeholder="Tell us what's on your mind..."
        />
        <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '4px' }}>
          {message.length} / 5000
        </div>
      </div>

      <TurnstileWidget onVerify={setCaptchaToken} />

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: '12px 24px',
          borderRadius: '8px',
          border: 'none',
          background: 'var(--teal)',
          color: 'white',
          fontWeight: '600',
          fontSize: '14px',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
          transition: 'opacity 0.2s',
        }}
      >
        {loading ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  );
}
