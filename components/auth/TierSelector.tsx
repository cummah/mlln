'use client';

import { useEffect, useState } from 'react';
import UpgradeModal from './UpgradeModal';

const TIERS = [
  {
    id: 1,
    name: 'Essential',
    features: ['Custom watchlist (20 assets)', 'Weekly & monthly signals', 'DCA scores & backtests']
  },
  {
    id: 2,
    name: 'Premium',
    features: ['All 2,000+ stocks & ETFs', 'Weekly & monthly signals', 'Sector views & ranking table', 'Full backtests'],
    highlight: true
  },
  {
    id: 3,
    name: 'Pro',
    features: ['Everything in Premium', 'Advanced analytics', 'Custom portfolios', 'API access']
  },
];

interface TierSelectorProps {
  initialTier?: number | null;
}

export default function TierSelector({ initialTier }: TierSelectorProps) {
  const [selectedTier, setSelectedTier] = useState<number | null>(null);

  useEffect(() => {
    if (initialTier && [1, 2, 3].includes(initialTier)) {
      setSelectedTier(initialTier);
    }
  }, [initialTier]);

  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
        marginBottom: '24px'
      }}>
        {TIERS.map((tier) => (
          <div
            key={tier.id}
            style={{
              background: tier.highlight ? 'var(--surface-elevated)' : 'var(--surface)',
              border: `1px solid ${tier.highlight ? 'var(--teal-mid)' : 'var(--border)'}`,
              borderRadius: '12px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              position: 'relative',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = 'var(--shadow-glow-teal)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = tier.highlight ? 'var(--shadow-glow-teal)' : 'none';
            }}
          >
            {tier.highlight && (
              <div style={{
                position: 'absolute',
                top: '-10px',
                left: '24px',
                background: 'var(--teal)',
                color: 'var(--bg)',
                fontSize: '10px',
                fontWeight: '700',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '4px 10px',
                borderRadius: '999px'
              }}>
                Most popular
              </div>
            )}

            <div>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: 'var(--text)',
                margin: '0 0 8px 0'
              }}>
                {tier.name}
              </h3>
            </div>

            <ul style={{
              listStyle: 'none',
              margin: '0',
              padding: '0',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              {tier.features.map((feature) => (
                <li
                  key={feature}
                  style={{
                    display: 'flex',
                    gap: '8px',
                    fontSize: '13px',
                    color: 'var(--text-2)',
                    lineHeight: '1.5'
                  }}
                >
                  <span style={{
                    color: 'var(--teal)',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}>✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => setSelectedTier(tier.id)}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                border: tier.highlight ? 'none' : '1px solid var(--border)',
                background: tier.highlight ? 'var(--teal)' : 'transparent',
                color: tier.highlight ? 'var(--bg)' : 'var(--teal)',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginTop: 'auto'
              }}
              onMouseEnter={(e) => {
                if (!tier.highlight) {
                  e.currentTarget.style.background = 'var(--teal)';
                  e.currentTarget.style.color = 'var(--bg)';
                  e.currentTarget.style.borderColor = 'var(--teal)';
                } else {
                  e.currentTarget.style.opacity = '0.9';
                }
              }}
              onMouseLeave={(e) => {
                if (!tier.highlight) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--teal)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                } else {
                  e.currentTarget.style.opacity = '1';
                }
              }}
            >
              Get {tier.name}
            </button>
          </div>
        ))}
      </div>

      {/* Payment methods - shown once */}
      <div style={{
        textAlign: 'center',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '24px',
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

      {selectedTier && (
        <UpgradeModal
          tier={selectedTier}
          tierName={TIERS.find(t => t.id === selectedTier)?.name || ''}
          isOpen={selectedTier !== null}
          onClose={() => setSelectedTier(null)}
        />
      )}
    </>
  );
}
