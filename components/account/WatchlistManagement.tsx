'use client';

import { useState, useEffect } from 'react';
import { useUpgradeFromError } from '@/hooks/useUpgradePrompt';
import UpgradePrompt from '@/components/upgrade/UpgradePrompt';

interface Watchlist {
  id: string;
  name: string;
  created_at: string;
}

interface WatchlistAsset {
  id: string;
  ticker: string;
}

interface WatchlistManagementProps {
  userId: string;
  tier: number;
  maxWatchlists: number;
}

export default function WatchlistManagement({ userId, tier, maxWatchlists }: WatchlistManagementProps) {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(null);
  const [assets, setAssets] = useState<WatchlistAsset[]>([]);
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [newAssetTicker, setNewAssetTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tickerSuggestions, setTickerSuggestions] = useState<string[]>([]);
  const [showTickerSuggestions, setShowTickerSuggestions] = useState(false);
  const { isOpen, props, close, handleError } = useUpgradeFromError();

  useEffect(() => {
    loadWatchlists();
  }, [userId]);

  useEffect(() => {
    if (selectedWatchlistId) {
      loadWatchlistAssets();
    }
  }, [selectedWatchlistId]);

  const loadWatchlists = async () => {
    try {
      const res = await fetch('/api/user/watchlists');
      if (!res.ok) throw new Error('Failed to load watchlists');
      const data = await res.json();
      setWatchlists(data);
      if (data.length > 0 && !selectedWatchlistId) {
        setSelectedWatchlistId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load watchlists:', err);
      setError('Failed to load watchlists');
    }
  };

  const loadWatchlistAssets = async () => {
    if (!selectedWatchlistId) return;
    try {
      const res = await fetch(`/api/user/watchlists/${selectedWatchlistId}`);
      if (!res.ok) throw new Error('Failed to load assets');
      const data = await res.json();
      setAssets(data.watchlist_assets || []);
    } catch (err) {
      console.error('Failed to load assets:', err);
    }
  };

  const handleCreateWatchlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWatchlistName.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/user/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWatchlistName }),
      });

      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.error || 'Failed to create watchlist');
        if (res.status === 403) {
          handleError(err, tier);
        } else {
          throw err;
        }
        return;
      }

      setNewWatchlistName('');
      setSuccess('Watchlist created!');
      await loadWatchlists();
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTickerInput = async (value: string) => {
    const upperValue = value.toUpperCase();
    setNewAssetTicker(upperValue);

    if (value.length < 1) {
      setTickerSuggestions([]);
      setShowTickerSuggestions(false);
      return;
    }

    try {
      const res = await fetch(`/api/assets/search?q=${encodeURIComponent(value)}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        const currentTickers = assets.map(a => a.ticker);
        setTickerSuggestions((data.tickers || []).filter((t: string) => !currentTickers.includes(t)));
        setShowTickerSuggestions(true);
      }
    } catch (err) {
      console.error('Failed to fetch suggestions:', err);
    }
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssetTicker.trim() || !selectedWatchlistId) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/user/watchlists/${selectedWatchlistId}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: newAssetTicker }),
      });

      if (!res.ok) {
        const data = await res.json();
        const err = new Error(data.error || 'Failed to add asset');
        if (res.status === 403) {
          handleError(err, tier);
        } else {
          throw err;
        }
        return;
      }

      setNewAssetTicker('');
      setTickerSuggestions([]);
      setShowTickerSuggestions(false);
      setSuccess('Asset added!');
      await loadWatchlistAssets();
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAsset = async (ticker: string) => {
    if (!selectedWatchlistId) return;

    try {
      const res = await fetch(`/api/user/watchlists/${selectedWatchlistId}/assets`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      });

      if (!res.ok) throw new Error('Failed to remove asset');
      setSuccess('Asset removed!');
      await loadWatchlistAssets();
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteWatchlist = async (id: string) => {
    if (!confirm('Are you sure you want to delete this watchlist?')) return;

    try {
      const res = await fetch(`/api/user/watchlists/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete watchlist');
      setSuccess('Watchlist deleted!');
      setSelectedWatchlistId(null);
      await loadWatchlists();
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '24px'
    }}>
      <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: 'var(--text)' }}>
        Custom Watchlists
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

      {/* Create Watchlist Form */}
      {watchlists.length < maxWatchlists && (
        <form onSubmit={handleCreateWatchlist} style={{ marginBottom: '24px', display: 'flex', gap: '12px' }}>
          <input
            type="text"
            placeholder="New watchlist name"
            value={newWatchlistName}
            onChange={(e) => setNewWatchlistName(e.target.value)}
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
            disabled={!newWatchlistName.trim() || loading}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--teal)',
              color: 'var(--bg)',
              fontWeight: '600',
              fontSize: '14px',
              cursor: loading || !newWatchlistName.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !newWatchlistName.trim() ? 0.6 : 1
            }}
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </form>
      )}

      {watchlists.length === 0 ? (
        <div style={{ color: 'var(--text-2)', fontSize: '14px', textAlign: 'center', padding: '24px' }}>
          No custom watchlists yet. Create one to get started!
        </div>
      ) : (
        <>
          {/* Watchlist Selector */}
          {watchlists.length > 1 && (
            <div style={{ marginBottom: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {watchlists.map(wl => (
                <button
                  key={wl.id}
                  onClick={() => setSelectedWatchlistId(wl.id)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: selectedWatchlistId === wl.id ? '1px solid var(--teal)' : '1px solid var(--border)',
                    background: selectedWatchlistId === wl.id ? 'var(--teal)' : 'transparent',
                    color: selectedWatchlistId === wl.id ? 'var(--bg)' : 'var(--text)',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  {wl.name}
                </button>
              ))}
            </div>
          )}

          {/* Asset Management */}
          {selectedWatchlistId && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: '600' }}>
                  Assets ({assets.length}/20)
                </label>
              </div>

              {/* Asset List */}
              {assets.length > 0 && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                  gap: '8px',
                  marginBottom: '16px'
                }}>
                  {assets.map(asset => (
                    <div
                      key={asset.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        gap: '8px'
                      }}
                    >
                      <span style={{ fontWeight: '600', color: 'var(--text)', fontSize: '13px' }}>
                        {asset.ticker}
                      </span>
                      <button
                        onClick={() => handleRemoveAsset(asset.ticker)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ff6b6b',
                          cursor: 'pointer',
                          fontSize: '14px',
                          padding: '0',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Asset Form */}
              {assets.length < 20 && (
                <form onSubmit={handleAddAsset} style={{ display: 'flex', gap: '8px', marginBottom: '16px', position: 'relative' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Add ticker (e.g., AAPL)"
                      value={newAssetTicker}
                      onChange={(e) => handleTickerInput(e.target.value)}
                      onFocus={() => newAssetTicker.length > 0 && setShowTickerSuggestions(true)}
                      disabled={loading}
                      maxLength={5}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        fontSize: '13px',
                        fontFamily: 'inherit',
                        textTransform: 'uppercase',
                        boxSizing: 'border-box'
                      }}
                    />
                    {/* Autocomplete suggestions */}
                    {showTickerSuggestions && tickerSuggestions.length > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          background: 'var(--surface-elevated)',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          marginTop: '4px',
                          zIndex: 10,
                          maxHeight: '200px',
                          overflowY: 'auto',
                        }}
                      >
                        {tickerSuggestions.map((ticker) => (
                          <button
                            key={ticker}
                            type="button"
                            onClick={() => {
                              setNewAssetTicker(ticker);
                              setShowTickerSuggestions(false);
                              setTickerSuggestions([]);
                            }}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--text)',
                              fontSize: '13px',
                              fontWeight: '500',
                              textAlign: 'left',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--border)',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface2)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            {ticker}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={!newAssetTicker || loading}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'var(--teal)',
                      color: 'var(--bg)',
                      fontWeight: '600',
                      fontSize: '13px',
                      cursor: loading || !newAssetTicker ? 'not-allowed' : 'pointer',
                      opacity: loading || !newAssetTicker ? 0.6 : 1
                    }}
                  >
                    Add
                  </button>
                </form>
              )}

              {/* Delete Button */}
              <button
                onClick={() => handleDeleteWatchlist(selectedWatchlistId)}
                style={{
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
                Delete Watchlist
              </button>
            </div>
          )}
        </>
      )}

      {isOpen && props && (
        <UpgradePrompt {...props} onClose={close} />
      )}
    </div>
  );
}
