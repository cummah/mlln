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
        <h1 style={{ margin: '0 0 12px 0', fontSize: '32px', fontWeight: '700' }}>Watchlists</h1>
        <p style={{ margin: '0', fontSize: '16px', color: 'var(--text-2)' }}>
          Curated watchlists of assets tracked by the model. See the latest buy signals and how each watchlist has performed.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
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
    </div>
  )
}
