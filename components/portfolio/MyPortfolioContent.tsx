'use client';

import { useState, useEffect } from 'react';

interface Portfolio {
  id: string;
  name: string;
  allocation_json: Record<string, number>;
  created_at: string;
}

interface MyPortfolioContentProps {
  user: any;
  portfolios: Portfolio[];
  tier: number;
}

export default function MyPortfolioContent({ user, portfolios, tier }: MyPortfolioContentProps) {
  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(null);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);

  useEffect(() => {
    if (portfolios.length > 0 && !activePortfolioId) {
      setActivePortfolioId(portfolios[0].id);
      setSelectedPortfolio(portfolios[0]);
    }
  }, [portfolios, activePortfolioId]);

  if (portfolios.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-2)' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px', color: 'var(--text)' }}>
          No saved portfolios yet
        </h2>
        <p>Create and save your first portfolio from the Portfolio Builder page.</p>
        <a href="/portfolio" style={{
          display: 'inline-block',
          marginTop: '16px',
          padding: '10px 20px',
          borderRadius: '8px',
          background: 'var(--teal)',
          color: 'var(--bg)',
          textDecoration: 'none',
          fontWeight: '600',
          fontSize: '14px'
        }}>
          Go to Portfolio Builder
        </a>
      </div>
    );
  }

  const allocationEntries = selectedPortfolio
    ? Object.entries(selectedPortfolio.allocation_json || {})
        .sort(([, a], [, b]) => (b as number) - (a as number))
    : [];

  return (
    <div>
      <h1 style={{ fontSize: '19px', fontWeight: '700', marginBottom: '24px', color: 'var(--text)' }}>
        My Portfolios
      </h1>

      {/* Portfolio selector (for tier 2+) */}
      {portfolios.length > 1 && (
        <div style={{ marginBottom: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {portfolios.map(p => (
            <button
              key={p.id}
              onClick={() => {
                setActivePortfolioId(p.id);
                setSelectedPortfolio(p);
              }}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: activePortfolioId === p.id ? '1px solid var(--teal)' : '1px solid var(--border)',
                background: activePortfolioId === p.id ? 'var(--teal)' : 'transparent',
                color: activePortfolioId === p.id ? 'var(--bg)' : 'var(--text)',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Active portfolio content */}
      {selectedPortfolio && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '24px',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--text)' }}>
            {selectedPortfolio.name}
          </h2>

          {allocationEntries.length === 0 ? (
            <div style={{ color: 'var(--text-2)' }}>No allocation set</div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '16px',
            }}>
              {allocationEntries.map(([ticker, allocation]) => (
                <div
                  key={ticker}
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text)' }}>
                      {ticker}
                    </div>
                    <div style={{ fontWeight: '600', fontSize: '16px', color: 'var(--teal)' }}>
                      {(allocation as number).toFixed(1)}%
                    </div>
                  </div>
                  <div style={{
                    height: '4px',
                    borderRadius: '2px',
                    background: 'var(--border)',
                    overflow: 'hidden',
                  }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${allocation}%`,
                        background: 'var(--teal)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '24px' }}>
        Manage your portfolios from the <a href="/portfolio" style={{ color: 'var(--teal)' }}>Portfolio Builder</a> or <a href="/account" style={{ color: 'var(--teal)' }}>account page</a>.
      </p>
    </div>
  );
}
