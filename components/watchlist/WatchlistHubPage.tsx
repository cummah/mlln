'use client'

import { useEffect, useState } from 'react'
import type { DemoWatchlist } from '@/lib/watchlist'
import type { WatchlistConfig } from '@/lib/watchlist-config'
import type { Entitlement } from '@/types'
import { WatchlistCard } from './WatchlistCard'

export function WatchlistHubPage({
  watchlists,
  data,
}: {
  watchlists: WatchlistConfig[]
  data: DemoWatchlist[]
}) {
  const [entitlement, setEntitlement] = useState<Entitlement>({ tier: 0, assets: new Set() })

  useEffect(() => {
    fetch('/api/user/entitlement')
      .then(res => res.json())
      .then(data => {
        setEntitlement({
          tier: data.tier,
          assets: new Set(data.assets || []),
        })
      })
      .catch(err => {
        console.error('Failed to fetch entitlement:', err)
        setEntitlement({ tier: 0, assets: new Set() })
      })
  }, [])

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ margin: '0 0 12px 0', fontSize: '32px', fontWeight: '700' }}>Curated Watchlists</h1>
        <p style={{ margin: '0 0 12px 0', fontSize: '16px', color: 'var(--text-2)', lineHeight: '1.6', maxWidth: '720px' }}>
          Track thematic portfolios of hand-picked assets across different themes. Each watchlist shows the enhanced DCA signals for this period and how a monthly plan would have performed compared to standard DCA and the broad market.
        </p>
        <p style={{ margin: '0', fontSize: '14px', color: 'var(--text-3)', maxWidth: '720px' }}>
          Pick a watchlist to see the current signals, build your own plan with custom amounts, and track your performance over time.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
          marginBottom: '40px',
        }}
      >
        {watchlists.map((config, idx) => (
          <WatchlistCard
            key={config.id}
            config={config}
            data={data[idx]}
            entitlement={entitlement}
          />
        ))}
      </div>

      <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '14px', padding: '24px', maxWidth: '720px' }}>
        <h2 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: '600', color: 'var(--text)' }}>Ready to invest?</h2>
        <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'var(--text-2)', lineHeight: '1.6' }}>
          Pick any watchlist above to see this month's signals and build a custom plan. Track your purchases, compare to standard DCA and SPY, and see how the strategy performs over time.
        </p>
        <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '13px', color: 'var(--text-2)', lineHeight: '1.8' }}>
          <li>Set your monthly or weekly budget per asset</li>
          <li>See what the model recommends buying this period</li>
          <li>Track actual buys against the performance chart</li>
          <li>Compare returns to benchmarks in real time</li>
        </ul>
      </div>
    </div>
  )
}
