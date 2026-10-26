'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CreateWatchlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  tickers: string[];
  tier: number;
}

export default function CreateWatchlistModal({ isOpen, onClose, tickers, tier }: CreateWatchlistModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const isPaidTier = tier >= 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter a watchlist name');
      return;
    }

    if (!isPaidTier) {
      setError('Upgrade to a paid plan to create custom watchlists');
      return;
    }

    setLoading(true);

    try {
      // Create watchlist
      const createRes = await fetch('/api/user/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        throw new Error(data.error || 'Failed to create watchlist');
      }

      const watchlist = await createRes.json();

      // Add assets to watchlist
      for (const ticker of tickers) {
        const assetRes = await fetch(`/api/user/watchlists/${watchlist.id}/assets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker }),
        });

        if (!assetRes.ok) {
          console.error(`Failed to add ${ticker} to watchlist`);
        }
      }

      // Navigate to the new watchlist
      router.push(`/my-watchlist/${watchlist.id}`);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create watchlist');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
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
        padding: '20px',
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: '12px',
          padding: '32px',
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div style={{ marginBottom: '24px' }}>
          <h2
            style={{
              fontSize: '20px',
              fontWeight: '700',
              color: 'var(--text)',
              margin: '0 0 8px 0',
            }}
          >
            Create Watchlist from Portfolio
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-2)', margin: 0 }}>
            Save this portfolio as a custom watchlist to track signals and performance.
          </p>
        </div>

        {!isPaidTier && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'rgba(255, 193, 7, 0.1)',
              border: '1px solid rgba(255, 193, 7, 0.3)',
              color: '#ffc107',
              fontSize: '13px',
              marginBottom: '16px',
              lineHeight: 1.5,
            }}
          >
            Custom watchlists are available to paid subscribers only. <a href="/pricing" style={{ color: '#ffc107', textDecoration: 'underline' }}>Upgrade now</a>.
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label
              htmlFor="watchlist-name"
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                color: 'var(--text-2)',
                marginBottom: '8px',
              }}
            >
              Watchlist Name
            </label>
            <input
              id="watchlist-name"
              type="text"
              placeholder="My AI Portfolio"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading || !isPaidTier}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: '14px',
                fontFamily: 'inherit',
                opacity: loading || !isPaidTier ? 0.6 : 1,
              }}
            />
            <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: '8px 0 0 0' }}>
              {tickers.length} asset{tickers.length !== 1 ? 's' : ''} will be added
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim() || !isPaidTier}
            style={{
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--teal)',
              color: 'var(--bg)',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loading || !name.trim() || !isPaidTier ? 'not-allowed' : 'pointer',
              opacity: loading || !name.trim() || !isPaidTier ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Creating...' : 'Create Watchlist'}
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
              transition: 'all 0.2s',
            }}
          >
            Cancel
          </button>

          {error && (
            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(255, 0, 0, 0.1)',
                color: '#ff6b6b',
                fontSize: '14px',
                border: '1px solid rgba(255, 107, 107, 0.3)',
              }}
            >
              {error}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
