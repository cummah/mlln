'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface WatchlistOption {
  id: string
  name: string
}

interface AddToWatchlistButtonProps {
  ticker: string
}

const buttonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '12px 22px',
  borderRadius: '10px',
  border: 'none',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
  background: 'var(--teal)',
  color: 'var(--bg)',
  cursor: 'pointer',
  transition: 'background 0.2s, box-shadow 0.2s, transform 0.2s',
} as const

export function AddToWatchlistButton({ ticker }: AddToWatchlistButtonProps) {
  const [watchlists, setWatchlists] = useState<WatchlistOption[] | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/api/user/watchlists')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: WatchlistOption[]) => {
        if (cancelled) return
        setWatchlists(data)
        setSelectedId(data[0]?.id ?? '')
      })
      .catch(() => {
        if (!cancelled) setWatchlists([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  const handleAdd = async () => {
    if (!selectedId) return

    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch(`/api/user/watchlists/${selectedId}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to add asset')

      const watchlistName = watchlists?.find((w) => w.id === selectedId)?.name
      setMessage({ type: 'success', text: `${ticker} added to ${watchlistName}` })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  if (watchlists === null) {
    return (
      <button type="button" disabled style={{ ...buttonStyle, opacity: 0.6, cursor: 'not-allowed' }}>
        Loading watchlists…
      </button>
    )
  }

  if (watchlists.length === 0) {
    return (
      <Link href="/my-watchlist" style={buttonStyle}>
        Create a watchlist to add {ticker}
      </Link>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
        {watchlists.length > 1 && (
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={saving}
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: '14px',
              fontFamily: 'inherit',
            }}
          >
            {watchlists.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          onClick={handleAdd}
          disabled={saving || !selectedId}
          style={{ ...buttonStyle, opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? 'Adding…' : `Add ${ticker} to watchlist`}
        </button>
      </div>

      {message && (
        <p
          style={{
            fontSize: '14px',
            margin: '12px 0 0',
            color: message.type === 'success' ? 'var(--teal)' : '#ff6b6b',
          }}
        >
          {message.type === 'success' ? '✓ ' : ''}
          {message.text}
        </p>
      )}
    </div>
  )
}
