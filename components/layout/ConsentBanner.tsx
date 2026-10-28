'use client';

import { useEffect, useState } from 'react';
import { getRejectionCookie, setConsentCookie } from '@/lib/consent';
import { X } from 'lucide-react';

export function ConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!getRejectionCookie()) {
      setShowBanner(true);
    }
  }, []);

  if (!showBanner) return null;

  const handleAccept = () => {
    setConsentCookie(true);
    setShowBanner(false);
  };

  const handleDecline = () => {
    setConsentCookie(false);
    setShowBanner(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        right: '20px',
        maxWidth: '420px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '16px',
        zIndex: 1000,
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', marginBottom: '8px' }}>
            Analytics & Cookies
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: '1.5', marginBottom: '12px' }}>
            We collect analytics data to understand how you use the site and improve the product. Learn more in our{' '}
            <a
              href="/cookie-policy"
              style={{ color: 'var(--teal)', textDecoration: 'none' }}
              target="_blank"
              rel="noopener noreferrer"
            >
              Cookie Policy
            </a>
            .
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleDecline}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-2)',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--surface2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              Decline
            </button>
            <button
              onClick={handleAccept}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: 'var(--teal)',
                color: 'white',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              Accept
            </button>
          </div>
        </div>
        <button
          onClick={handleDecline}
          style={{
            padding: '4px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--text-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
