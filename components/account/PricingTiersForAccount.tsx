'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Tier {
  id: string;
  tierNum: number;
  name: string;
  tagline: string;
  monthly: number;
  features: string[];
  cta: string;
  highlight?: boolean;
}

const LAUNCH_DISCOUNT = 0.5;

const TIERS: Tier[] = [
  {
    id: 'watchlist',
    tierNum: 1,
    name: 'Watchlist',
    tagline: 'For investors who know what they own.',
    monthly: 12,
    features: [
      'Custom watchlist of up to 20 assets',
      'Weekly and monthly Enhanced DCA signals',
      'How much to buy this period, per asset',
      'Watchlist YTD vs standard DCA and SPY',
    ],
    cta: 'Upgrade to Watchlist',
  },
  {
    id: 'full',
    tierNum: 2,
    name: 'Full access',
    tagline: 'For investors who want to find the best places to put money.',
    monthly: 29,
    features: [
      'All 2,000+ stocks and ETFs',
      'Weekly and monthly Enhanced DCA signals',
      'Sector views and the full ranking table',
      'Backtests and DCA scores for every asset',
      'Unlimited watchlists',
    ],
    cta: 'Upgrade to Full access',
    highlight: true,
  },
  {
    id: 'pro',
    tierNum: 3,
    name: 'Pro',
    tagline: 'Active Traders and Investors.',
    monthly: 49,
    features: [
      'Everything in Full access',
      'Institutional grade TradingView indicators and strategies',
      'Use them across any asset and timeframe',
    ],
    cta: 'Upgrade to Pro',
  },
];

const gbp = (n: number) => `£${n.toLocaleString('en-GB')}`;

export default function PricingTiersForAccount() {
  const router = useRouter();
  const [loadingTier, setLoadingTier] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async (tier: Tier) => {
    setLoadingTier(tier.tierNum);
    setError(null);

    try {
      const response = await fetch('/api/checkout/revolut', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: tier.tierNum }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to initiate checkout');
        setLoadingTier(null);
        return;
      }

      // Redirect to Revolut checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoadingTier(null);
    }
  };

  return (
    <div style={{ marginBottom: '40px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px', color: 'var(--text)' }}>
          Upgrade Your Plan
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--text-2)', margin: 0 }}>
          Choose a plan to unlock advanced features and analysis
        </p>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: 'rgba(255, 107, 107, 0.1)',
          color: '#ff6b6b',
          border: '1px solid rgba(255, 107, 107, 0.3)',
          marginBottom: '24px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '20px',
        marginBottom: '24px'
      }}>
        {TIERS.map((tier) => {
          const fullMonthly = tier.monthly / (1 - LAUNCH_DISCOUNT);
          const yearly = tier.monthly * 12;
          const fullYearly = fullMonthly * 12;

          return (
            <div
              key={tier.id}
              style={{
                background: tier.highlight ? 'var(--surface-elevated)' : 'var(--surface)',
                border: `1px solid ${tier.highlight ? 'var(--teal-mid)' : 'var(--border)'}`,
                borderRadius: '16px',
                padding: '28px 26px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
                position: 'relative',
                boxShadow: tier.highlight ? 'var(--shadow-glow-teal)' : 'none',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {tier.highlight && (
                <div style={{
                  position: 'absolute',
                  top: '-11px',
                  left: '26px',
                  background: 'var(--teal)',
                  color: 'var(--bg)',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '4px 10px',
                  borderRadius: '999px'
                }}>
                  Most popular
                </div>
              )}

              <div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>{tier.name}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: '4px', minHeight: '38px', lineHeight: 1.45 }}>{tier.tagline}</div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '40px', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)' }}>{gbp(tier.monthly)}</span>
                  <span style={{ fontSize: '14px', color: 'var(--text-2)' }}>/month</span>
                  <span style={{ fontSize: '15px', color: 'var(--text-3)', textDecoration: 'line-through', marginLeft: 'auto' }}>{gbp(fullMonthly)}</span>
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-2)', marginTop: '6px' }}>
                  Billed annually at <strong style={{ color: 'var(--text)' }}>{gbp(yearly)}</strong>{' '}
                  <span style={{ color: 'var(--text-3)', textDecoration: 'line-through' }}>{gbp(fullYearly)}</span>
                </div>
                <div style={{ display: 'inline-block', marginTop: '10px', fontSize: '11px', fontWeight: 600, color: 'var(--green)', background: 'var(--green-dim)', padding: '3px 9px', borderRadius: '999px' }}>
                  50% launch discount · save {gbp(fullYearly - yearly)}
                </div>
              </div>

              <button
                onClick={() => handleUpgrade(tier)}
                disabled={loadingTier === tier.tierNum}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: tier.highlight ? 'none' : '1px solid var(--border)',
                  background: tier.highlight ? 'var(--teal)' : 'transparent',
                  color: tier.highlight ? 'var(--bg)' : 'var(--teal)',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: loadingTier === tier.tierNum ? 'not-allowed' : 'pointer',
                  opacity: loadingTier === tier.tierNum ? 0.6 : 1,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (loadingTier !== tier.tierNum) {
                    if (!tier.highlight) {
                      e.currentTarget.style.background = 'var(--teal)';
                      e.currentTarget.style.color = 'var(--bg)';
                      e.currentTarget.style.borderColor = 'var(--teal)';
                    } else {
                      e.currentTarget.style.opacity = '0.9';
                    }
                  }
                }}
                onMouseLeave={(e) => {
                  if (loadingTier !== tier.tierNum) {
                    if (!tier.highlight) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--teal)';
                      e.currentTarget.style.borderColor = 'var(--border)';
                    } else {
                      e.currentTarget.style.opacity = '1';
                    }
                  }
                }}
              >
                {loadingTier === tier.tierNum ? 'Redirecting...' : tier.cta}
              </button>

              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '11px' }}>
                {tier.features.map(f => (
                  <li key={f} style={{ display: 'flex', gap: '10px', fontSize: '13.5px', lineHeight: 1.5, color: 'var(--text-2)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="3" style={{ flexShrink: 0, marginTop: '3px' }}>
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div style={{
        textAlign: 'center',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '12px',
        color: 'var(--text-2)',
        fontSize: '12px'
      }}>
        <span>Secured by</span>
        <img
          src="https://assets.revolut.com/assets/payment-schemes/Revolut-Dark.svg"
          height={18}
          alt="Revolut"
        />
        <img
          src="https://assets.revolut.com/assets/payment-schemes/Visa.svg"
          height={18}
          alt="Visa"
        />
        <img
          src="https://assets.revolut.com/assets/payment-schemes/Mastercard.svg"
          height={18}
          alt="Mastercard"
        />
      </div>
    </div>
  );
}
