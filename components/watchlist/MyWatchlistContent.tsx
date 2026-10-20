'use client';

import { useState, useEffect } from 'react';

interface Watchlist {
  id: string;
  name: string;
  created_at: string;
}

interface MyWatchlistContentProps {
  user: any;
  watchlists: Watchlist[];
  tier: number;
}

export default function MyWatchlistContent({ user, watchlists, tier }: MyWatchlistContentProps) {
  const [activeWatchlistId, setActiveWatchlistId] = useState<string | null>(null);
  const [assets, setAssets] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (watchlists.length > 0 && !activeWatchlistId) {
      setActiveWatchlistId(watchlists[0].id);
    }
  }, [watchlists, activeWatchlistId]);

  useEffect(() => {
    if (activeWatchlistId) {
      loadWatchlistAssets();
    }
  }, [activeWatchlistId]);

  const loadWatchlistAssets = async () => {
    if (!activeWatchlistId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/user/watchlists/${activeWatchlistId}`);
      if (!response.ok) throw new Error('Failed to load watchlist');
      const data = await response.json();
      setAssets((data.watchlist_assets || []).map((a: any) => a.ticker).sort());
    } catch (err) {
      console.error('Failed to load assets:', err);
    } finally {
      setLoading(false);
    }
  };

  if (watchlists.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-2)' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px', color: 'var(--text)' }}>
          No watchlist yet
        </h2>
        <p>Create your first custom watchlist on your account page to get started.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: '19px', fontWeight: '700', marginBottom: '24px', color: 'var(--text)' }}>
        My Watchlist
      </h1>

      {/* Watchlist selector (for tier 2+) */}
      {watchlists.length > 1 && (
        <div style={{ marginBottom: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {watchlists.map(wl => (
            <button
              key={wl.id}
              onClick={() => setActiveWatchlistId(wl.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: activeWatchlistId === wl.id ? '1px solid var(--teal)' : '1px solid var(--border)',
                background: activeWatchlistId === wl.id ? 'var(--teal)' : 'transparent',
                color: activeWatchlistId === wl.id ? 'var(--bg)' : 'var(--text)',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              {wl.name}
            </button>
          ))}
        </div>
      )}

      {/* Active watchlist content */}
      {activeWatchlistId && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '24px',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--text)' }}>
            Assets ({assets.length})
          </h2>

          {loading ? (
            <div style={{ color: 'var(--text-2)' }}>Loading...</div>
          ) : assets.length === 0 ? (
            <div style={{ color: 'var(--text-2)' }}>No assets added yet</div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
              gap: '12px',
            }}>
              {assets.map(ticker => (
                <div
                  key={ticker}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: 'var(--text)',
                  }}
                >
                  {ticker}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '24px' }}>
        Manage your watchlist assets on your <a href="/account" style={{ color: 'var(--teal)' }}>account page</a>.
      </p>
    </div>
  );
}
