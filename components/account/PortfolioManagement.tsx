'use client';

import { useState, useEffect } from 'react';

interface Portfolio {
  id: string;
  name: string;
  allocation_json: Record<string, number>;
  created_at: string;
}

interface PortfolioManagementProps {
  userId: string;
  tier: number;
  maxPortfolios: number;
}

export default function PortfolioManagement({ userId, tier, maxPortfolios }: PortfolioManagementProps) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadPortfolios();
  }, [userId]);

  const loadPortfolios = async () => {
    try {
      const res = await fetch('/api/user/portfolios');
      if (!res.ok) throw new Error('Failed to load portfolios');
      const data = await res.json();
      setPortfolios(data);
      if (data.length > 0 && !selectedPortfolioId) {
        setSelectedPortfolioId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load portfolios:', err);
      setError('Failed to load portfolios');
    }
  };

  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPortfolioName.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/user/portfolios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPortfolioName,
          allocation_json: {}
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create portfolio');

      setNewPortfolioName('');
      setSuccess('Portfolio created! Build it in the Portfolio Builder.');
      await loadPortfolios();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePortfolio = async (id: string) => {
    if (!confirm('Are you sure you want to delete this portfolio?')) return;

    try {
      const res = await fetch(`/api/user/portfolios/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete portfolio');
      setSuccess('Portfolio deleted!');
      setSelectedPortfolioId(null);
      await loadPortfolios();
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const selectedPortfolio = portfolios.find(p => p.id === selectedPortfolioId);
  const allocationEntries = selectedPortfolio
    ? Object.entries(selectedPortfolio.allocation_json || {})
        .sort(([, a], [, b]) => (b as number) - (a as number))
    : [];

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '24px',
    }}>
      <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: 'var(--text)' }}>
        Saved Portfolios
      </h2>

      {error && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: 'rgba(255, 107, 107, 0.1)',
          color: '#ff6b6b',
          border: '1px solid rgba(255, 107, 107, 0.3)',
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: 'rgba(0, 200, 180, 0.1)',
          color: 'var(--teal)',
          border: '1px solid rgba(0, 200, 180, 0.3)',
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          ✓ {success}
        </div>
      )}

      {/* Create Portfolio Form */}
      {portfolios.length < maxPortfolios && (
        <form onSubmit={handleCreatePortfolio} style={{ marginBottom: '24px', display: 'flex', gap: '12px' }}>
          <input
            type="text"
            placeholder="New portfolio name"
            value={newPortfolioName}
            onChange={(e) => setNewPortfolioName(e.target.value)}
            disabled={loading}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: '14px',
              fontFamily: 'inherit',
            }}
          />
          <button
            type="submit"
            disabled={!newPortfolioName.trim() || loading}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--teal)',
              color: 'var(--bg)',
              fontWeight: '600',
              fontSize: '14px',
              cursor: loading || !newPortfolioName.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !newPortfolioName.trim() ? 0.6 : 1
            }}
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </form>
      )}

      {portfolios.length === 0 ? (
        <div style={{ color: 'var(--text-2)', fontSize: '14px', textAlign: 'center', padding: '24px' }}>
          <p>No saved portfolios yet. Create one to get started!</p>
          <a href="/portfolio" style={{
            display: 'inline-block',
            marginTop: '12px',
            padding: '8px 16px',
            borderRadius: '6px',
            background: 'rgba(0, 200, 180, 0.1)',
            color: 'var(--teal)',
            textDecoration: 'none',
            fontWeight: '600',
            fontSize: '13px'
          }}>
            Go to Portfolio Builder →
          </a>
        </div>
      ) : (
        <>
          {/* Portfolio Selector */}
          {portfolios.length > 1 && (
            <div style={{ marginBottom: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {portfolios.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPortfolioId(p.id)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: selectedPortfolioId === p.id ? '1px solid var(--teal)' : '1px solid var(--border)',
                    background: selectedPortfolioId === p.id ? 'var(--teal)' : 'transparent',
                    color: selectedPortfolioId === p.id ? 'var(--bg)' : 'var(--text)',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {/* Portfolio Details */}
          {selectedPortfolio && (
            <div style={{
              background: 'var(--surface2)',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '16px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
              }}>
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', margin: 0 }}>
                    {selectedPortfolio.name}
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '4px' }}>
                    {allocationEntries.length} assets · Created {new Date(selectedPortfolio.created_at).toLocaleDateString()}
                  </div>
                </div>
                <a href="/portfolio" style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  background: 'rgba(0, 200, 180, 0.1)',
                  color: 'var(--teal)',
                  textDecoration: 'none',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  Edit
                </a>
              </div>

              {allocationEntries.length === 0 ? (
                <div style={{ color: 'var(--text-3)', fontSize: '13px', textAlign: 'center', padding: '12px' }}>
                  Go to Portfolio Builder to build this portfolio
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: '10px'
                }}>
                  {allocationEntries.map(([ticker, allocation]) => (
                    <div
                      key={ticker}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '6px',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text)' }}>
                        {ticker}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--teal)', marginTop: '4px', fontWeight: '600' }}>
                        {(allocation as number).toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => handleDeletePortfolio(selectedPortfolio.id)}
                style={{
                  marginTop: '16px',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #ff6b6b',
                  background: 'transparent',
                  color: '#ff6b6b',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Delete Portfolio
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
