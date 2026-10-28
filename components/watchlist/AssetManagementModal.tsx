'use client'

import { useState, useMemo } from 'react'

interface AssetManagementModalProps {
  isOpen: boolean
  onClose: () => void
  watchlistId: string
  currentAssets: string[]
  onAssetsChanged: () => void
}

export function AssetManagementModal({ isOpen, onClose, watchlistId, currentAssets, onAssetsChanged }: AssetManagementModalProps) {
  const [newTicker, setNewTicker] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [assets, setAssets] = useState<string[]>(currentAssets)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault()
    const ticker = newTicker.trim().toUpperCase()

    if (!ticker) return
    if (assets.includes(ticker)) {
      setError('This asset is already in the watchlist')
      return
    }
    if (assets.length >= 20) {
      setError('Watchlist has reached the maximum of 20 assets')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/user/watchlists/${watchlistId}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to add asset')
      }

      setAssets([...assets, ticker])
      setNewTicker('')
      setSuggestions([])
      setShowSuggestions(false)
      setSuccess(`${ticker} added!`)
      setTimeout(() => setSuccess(null), 2000)
      onAssetsChanged()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveAsset = async (ticker: string) => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/user/watchlists/${watchlistId}/assets`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      })

      if (!res.ok) throw new Error('Failed to remove asset')

      setAssets(assets.filter(a => a !== ticker))
      setSuccess(`${ticker} removed!`)
      setTimeout(() => setSuccess(null), 2000)
      onAssetsChanged()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTickerInput = async (value: string) => {
    setNewTicker(value.toUpperCase())

    if (value.length < 1) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    try {
      const res = await fetch(`/api/assets/search?q=${encodeURIComponent(value)}&limit=5`)
      if (res.ok) {
        const data = await res.json()
        setSuggestions((data.tickers || []).filter((t: string) => !assets.includes(t)))
        setShowSuggestions(true)
      }
    } catch (err) {
      console.error('Failed to fetch suggestions:', err)
    }
  }

  if (!isOpen) return null

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
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: '12px',
          padding: '32px',
          width: '100%',
          maxWidth: '500px',
          maxHeight: '80vh',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
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
            Manage Assets
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-2)', margin: 0 }}>
            Add or remove assets from your watchlist ({assets.length}/20)
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'rgba(255, 0, 0, 0.1)',
              color: '#ff6b6b',
              fontSize: '14px',
              border: '1px solid rgba(255, 107, 107, 0.3)',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'rgba(0, 200, 180, 0.1)',
              color: 'var(--teal)',
              border: '1px solid rgba(0, 200, 180, 0.3)',
              marginBottom: '16px',
              fontSize: '14px',
            }}
          >
            ✓ {success}
          </div>
        )}

        {/* Current Assets */}
        {assets.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: '600', display: 'block', marginBottom: '12px' }}>
              Current Assets ({assets.length})
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '8px' }}>
              {assets.map((ticker) => (
                <div
                  key={ticker}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    gap: '8px',
                  }}
                >
                  <span style={{ fontWeight: '600', color: 'var(--text)', fontSize: '13px' }}>
                    {ticker}
                  </span>
                  <button
                    onClick={() => handleRemoveAsset(ticker)}
                    disabled={loading}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ff6b6b',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      padding: '0',
                      display: 'flex',
                      alignItems: 'center',
                      opacity: loading ? 0.6 : 1,
                    }}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Asset Form */}
        {assets.length < 20 && (
          <form onSubmit={handleAddAsset} style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
              Add Asset
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search ticker (e.g., AAPL)"
                value={newTicker}
                onChange={(e) => handleTickerInput(e.target.value)}
                onFocus={() => newTicker.length > 0 && setShowSuggestions(true)}
                disabled={loading || assets.length >= 20}
                maxLength={5}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  textTransform: 'uppercase',
                  boxSizing: 'border-box',
                }}
              />

              {/* Autocomplete suggestions */}
              {showSuggestions && suggestions.length > 0 && (
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
                  {suggestions.map((ticker) => (
                    <button
                      key={ticker}
                      type="button"
                      onClick={() => {
                        setNewTicker(ticker)
                        setShowSuggestions(false)
                        setSuggestions([])
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
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
              disabled={!newTicker.trim() || loading || assets.length >= 20}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: '6px',
                border: 'none',
                background: 'var(--teal)',
                color: '#040e18',
                fontWeight: '600',
                fontSize: '13px',
                cursor: !newTicker.trim() || loading || assets.length >= 20 ? 'not-allowed' : 'pointer',
                opacity: !newTicker.trim() || loading || assets.length >= 20 ? 0.6 : 1,
                marginTop: '8px',
              }}
            >
              Add Asset
            </button>
          </form>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text)',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Done
        </button>
      </div>
    </div>
  )
}
