'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { DemoWatchlist } from '@/lib/watchlist'
import type { WatchlistConfig } from '@/lib/watchlist-config'
import type { Entitlement } from '@/types'
import { MiniChart } from './MiniChart'

function getPeriodLabel(startDate: string): string {
  const start = new Date(startDate)
  const now = new Date()
  const years = (now.getTime() - start.getTime()) / (365.25 * 86400000)
  if (years >= 2.9) return 'over 3 years'
  if (years >= 1.9) return 'over 2 years'
  if (years >= 1) return 'over 1 year'
  const months = Math.round(years * 12)
  return `over ${months} month${months === 1 ? '' : 's'}`
}

export function WatchlistCard({
  config,
  data,
  entitlement,
}: {
  config: WatchlistConfig
  data: DemoWatchlist
  entitlement?: Entitlement
}) {
  const canAccess = entitlement ? entitlement.tier >= 2 : false
  const periodLabel = getPeriodLabel(config.startDate)

  return (
    <Link href={`/watchlist/${config.id}`}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-elevated)',
          borderRadius: '14px',
          padding: '20px',
          cursor: 'pointer',
          transition: 'all 0.2s',
          height: '100%',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget
          el.style.borderColor = 'var(--teal)'
          el.style.boxShadow = '0 4px 12px rgba(15, 163, 139, 0.1)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget
          el.style.borderColor = 'var(--border-elevated)'
          el.style.boxShadow = 'none'
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>
            {config.name}
          </h3>
          <p style={{ margin: '0', fontSize: '13px', color: 'var(--text-2)', lineHeight: '1.4' }}>
            {config.description}
          </p>
        </div>

        {/* Chart */}
        <div style={{ marginBottom: '16px', minHeight: '100px' }}>
          {data.ytd ? (
            <MiniChart ytd={data.ytd} canAccess={canAccess} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100px', color: 'var(--text-2)' }}>
              No data available
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>
            {data.rows.length} assets {periodLabel}
          </div>
          <ChevronRight size={18} style={{ color: 'var(--text-2)' }} />
        </div>
      </div>
    </Link>
  )
}
