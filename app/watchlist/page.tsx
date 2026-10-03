import type { Metadata } from 'next'
import { WatchlistContent } from './WatchlistContent'

export const metadata: Metadata = {
  title: 'Watchlist — Monitor Portfolio Signals | mlln.ai',
  description:
    'Monitor your portfolio assets for the latest weekly and monthly signals. Track allocations and execution status in one view.',
}

export const revalidate = 3600

export default function WatchlistPage() {
  return (
    <div
      className="min-h-screen bg-[var(--bg)]"
      style={{ padding: '14px 18px 24px', maxWidth: '1600px', marginLeft: 'auto', marginRight: 'auto' }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '14px',
          flexWrap: 'wrap',
          marginBottom: '12px',
        }}
      >
        <h1 style={{ fontSize: '19px', fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.2px' }}>
          Portfolio Watchlist
        </h1>
        <p style={{ fontSize: '12px', color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
          Monitor your portfolio for weekly and monthly signals. Add assets on the left, track execution status and allocations.
        </p>
      </header>

      <WatchlistContent />
    </div>
  )
}
