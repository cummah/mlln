'use client';

import { useState } from 'react';

export interface UpgradePromptProps {
  currentTier: number;
  requiredTier: number;
  feature: string;
  reason: 'tier_locked' | 'quota_exceeded';
  tierBenefits?: Record<number, string[]>;
  onClose?: () => void;
}

const TIER_NAMES: Record<number, string> = {
  1: 'Essential',
  2: 'Full Access',
  3: 'Pro',
};

const TIER_PRICES: Record<number, string> = {
  1: '£144/year',
  2: '£348/year',
  3: '£588/year',
};

const DEFAULT_BENEFITS: Record<number, string[]> = {
  1: ['1 Custom Watchlist', '1 Portfolio', '5 Asset Swaps/Month', 'Email Support'],
  2: ['3 Watchlists', '2 Portfolios', '50 Asset Swaps/Month', 'Priority Support'],
  3: ['5 Watchlists', '3 Portfolios', 'Unlimited Swaps', '24/7 Support'],
};

export default function UpgradePrompt({
  currentTier,
  requiredTier,
  feature,
  reason,
  tierBenefits = DEFAULT_BENEFITS,
  onClose,
}: UpgradePromptProps) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async (tier: number) => {
    setLoading(true);
    try {
      const response = await fetch('/api/checkout/revolut', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });

      const data = await response.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      console.error('Checkout error:', err);
    } finally {
      setLoading(false);
    }
  };

  const reasonText =
    reason === 'quota_exceeded'
      ? `You've hit the ${TIER_NAMES[currentTier]} limit for ${feature}`
      : `${feature} requires ${TIER_NAMES[requiredTier]} or higher`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg)',
          borderRadius: '12px',
          padding: '32px',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflow: 'auto',
          border: '1px solid var(--border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'transparent',
            border: 'none',
            fontSize: '24px',
            color: 'var(--text-2)',
            cursor: 'pointer',
            padding: '8px',
          }}
        >
          ×
        </button>

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: '700',
              marginBottom: '8px',
              color: 'var(--text)',
            }}
          >
            Upgrade to {TIER_NAMES[requiredTier]}
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-2)', margin: 0 }}>
            {reasonText}
          </p>
        </div>

        {/* Tier Comparison */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: currentTier === 0 ? '1fr 1fr' : '1fr 1fr 1fr',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          {currentTier === 0 && (
            <div
              style={{
                padding: '16px',
                background: 'var(--surface)',
                borderRadius: '8px',
                border: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--text-2)',
                  marginBottom: '8px',
                }}
              >
                Free (Current)
              </div>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  fontSize: '12px',
                  color: 'var(--text-3)',
                }}
              >
                <li style={{ marginBottom: '4px' }}>• No Watchlists</li>
                <li style={{ marginBottom: '4px' }}>• No Portfolios</li>
                <li>• Limited Features</li>
              </ul>
            </div>
          )}

          {[requiredTier, ...(requiredTier < 3 ? [requiredTier + 1] : [])].map((tier) => (
            <div
              key={tier}
              style={{
                padding: '16px',
                background: tier === requiredTier ? 'rgba(0, 200, 180, 0.1)' : 'var(--surface)',
                borderRadius: '8px',
                border:
                  tier === requiredTier
                    ? '2px solid var(--teal)'
                    : '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: tier === requiredTier ? 'var(--teal)' : 'var(--text)',
                  marginBottom: '4px',
                }}
              >
                {TIER_NAMES[tier]}
              </div>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: 'var(--text)',
                  marginBottom: '8px',
                }}
              >
                {TIER_PRICES[tier]}
              </div>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  fontSize: '12px',
                  color: 'var(--text-2)',
                }}
              >
                {(tierBenefits[tier] || []).map((benefit, i) => (
                  <li key={i} style={{ marginBottom: '4px' }}>
                    ✓ {benefit}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleUpgrade(tier)}
                disabled={loading}
                style={{
                  width: '100%',
                  marginTop: '12px',
                  padding: '8px',
                  borderRadius: '6px',
                  border: 'none',
                  background:
                    tier === requiredTier ? 'var(--teal)' : 'var(--surface-elevated)',
                  color:
                    tier === requiredTier ? 'var(--bg)' : 'var(--text)',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? 'Loading...' : 'Choose'}
              </button>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div
          style={{
            fontSize: '12px',
            color: 'var(--text-3)',
            padding: '16px',
            background: 'var(--surface)',
            borderRadius: '8px',
          }}
        >
          <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--text-2)' }}>
            Questions?
          </div>
          <ul style={{ margin: 0, paddingLeft: '16px' }}>
            <li>Annual billing • Cancel anytime</li>
            <li>Money-back guarantee within 30 days</li>
            <li>Quotas reset monthly on renewal</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
