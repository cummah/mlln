'use client';

import { useState } from 'react';
import UpgradeModal from './UpgradeModal';

const TIERS = [
  { id: 1, name: 'Essential', button: 'Get Essential' },
  { id: 2, name: 'Premium', button: 'Get Premium Access' },
  { id: 3, name: 'Pro', button: 'Get Pro Access' },
];

export default function TierSelector() {
  const [selectedTier, setSelectedTier] = useState<number | null>(null);

  return (
    <>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {TIERS.map((tier) => (
          <div key={tier.id} style={{
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            alignItems: 'stretch',
            width: '100%'
          }}>
            <button
              onClick={() => setSelectedTier(tier.id)}
              style={{
                padding: '16px 20px',
                borderRadius: '999px',
                fontFamily: 'Arial',
                fontSize: '16px',
                fontWeight: 'normal',
                textDecoration: 'none',
                textAlign: 'center',
                cursor: 'pointer',
                width: '100%',
                boxSizing: 'border-box',
                background: '#00c4a7',
                color: '#ffffff',
                border: 'none',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              {tier.button}
            </button>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '6px',
              marginTop: '12px'
            }}>
              <img
                src="https://assets.revolut.com/assets/payment-schemes/Revolut-Dark.svg"
                height={22}
                alt="Revolut Pay"
              />
              <img
                src="https://assets.revolut.com/assets/payment-schemes/Visa.svg"
                height={22}
                alt="Visa"
              />
              <img
                src="https://assets.revolut.com/assets/payment-schemes/Amex.svg"
                height={22}
                alt="Amex"
              />
              <img
                src="https://assets.revolut.com/assets/payment-schemes/Mastercard.svg"
                height={22}
                alt="Mastercard"
              />
            </div>
          </div>
        ))}
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
