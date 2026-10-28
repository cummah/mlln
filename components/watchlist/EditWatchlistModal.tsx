'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface EditWatchlistModalProps {
  isOpen: boolean
  onClose: () => void
  watchlistId: string
  currentName: string
  currentInceptionDate: string
}

const dateToInputValue = (dateStr: string) => dateStr

export function EditWatchlistModal({ isOpen, onClose, watchlistId, currentName, currentInceptionDate }: EditWatchlistModalProps) {
  const router = useRouter()
  const [name, setName] = useState(currentName)
  const [inceptionDate, setInceptionDate] = useState(currentInceptionDate)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`/api/user/watchlists/${watchlistId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          inception_date: inceptionDate,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update watchlist')
      }

      router.refresh()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to update watchlist')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this watchlist? This cannot be undone.')) {
      return
    }

    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`/api/user/watchlists/${watchlistId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Failed to delete watchlist')
      }

      router.push('/my-watchlist')
    } catch (err: any) {
      setError(err.message || 'Failed to delete watchlist')
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const today = new Date().toISOString().split('T')[0]
  const sixYearsAgo = new Date()
  sixYearsAgo.setUTCFullYear(sixYearsAgo.getUTCFullYear() - 6)
  const sixYearsAgoStr = sixYearsAgo.toISOString().split('T')[0]

  const setQuickDate = (days: number) => {
    const date = new Date()
    date.setUTCDate(date.getUTCDate() - days)
    setInceptionDate(date.toISOString().split('T')[0])
  }

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
          maxWidth: '450px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
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
            Edit Watchlist
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-2)', margin: 0 }}>
            Update your watchlist name and tracking start date.
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Name field */}
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: '14px',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Inception Date field */}
          <div>
            <label
              htmlFor="inception-date"
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                color: 'var(--text-2)',
                marginBottom: '8px',
              }}
            >
              Tracking Start Date
            </label>
            <input
              id="inception-date"
              type="date"
              value={inceptionDate}
              onChange={(e) => setInceptionDate(e.target.value)}
              disabled={loading}
              min={sixYearsAgoStr}
              max={today}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: '14px',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
            <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: '8px 0 0 0' }}>
              Choose how far back to track: allocation history and performance data will start from this date.
            </p>
          </div>

          {/* Quick date buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setQuickDate(365)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-2)',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              1 year
            </button>
            <button
              type="button"
              onClick={() => setQuickDate(365 * 3)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-2)',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              3 years
            </button>
            <button
              type="button"
              onClick={() => setQuickDate(365 * 6)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-2)',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              6 years
            </button>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text)',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--teal)',
                color: '#040e18',
                fontSize: '14px',
                fontWeight: '600',
                cursor: !name.trim() || loading ? 'not-allowed' : 'pointer',
                opacity: !name.trim() || loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>

          {/* Delete button */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #ff6b6b',
              background: 'transparent',
              color: '#ff6b6b',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '12px',
              opacity: loading ? 0.6 : 1,
            }}
          >
            Delete Watchlist
          </button>
        </form>
      </div>
    </div>
  )
}
