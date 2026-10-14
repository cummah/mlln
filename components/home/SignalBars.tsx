'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import type { DemoWatchlist } from '@/lib/watchlist'

/** This month's signal for each asset on the Top 10 Watchlist: how much of the normal contribution to buy. */
export function SignalBars({ data }: { data: DemoWatchlist }) {
  const reduce = useReducedMotion()
  const rows = data.rows.map(r => ({
    ticker: r.ticker,
    name: r.name,
    mult: r.monthly && r.monthly.inLatestPeriod ? r.monthly.mult : null,
  }))
  const max = Math.max(2, ...rows.map(r => r.mult ?? 0))
  const month = data.latestDate.monthly
    ? new Date(data.latestDate.monthly + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    : null

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{data.name}{month ? `, ${month}` : ''}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>Line marks your normal amount (1×)</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
        {rows.map((r, i) => (
          <div key={r.ticker} style={{ display: 'grid', gridTemplateColumns: '58px 1fr 64px', gap: '12px', alignItems: 'center' }}>
            <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text)' }} title={r.name}>{r.ticker}</div>
            <div style={{ position: 'relative', height: '20px', background: 'var(--surface2)', borderRadius: '6px' }}>
              <div style={{ position: 'absolute', left: `${(1 / max) * 100}%`, top: '-3px', bottom: '-3px', width: '1px', background: 'var(--text-3)' }} />
              {r.mult !== null ? (
                <motion.div
                  style={{
                    height: '100%',
                    borderRadius: '6px',
                    transformOrigin: 'left',
                    width: `${Math.min(r.mult / max, 1) * 100}%`,
                    background: r.mult > 1 ? 'var(--teal)' : r.mult < 1 ? 'var(--amber)' : 'var(--teal-mid)',
                  }}
                  initial={reduce ? false : { scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.9, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                />
              ) : (
                <div style={{ fontSize: '11px', color: 'var(--text-3)', lineHeight: '20px', paddingLeft: '10px' }}>no signal this month</div>
              )}
            </div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12.5px', textAlign: 'right', color: r.mult === null ? 'var(--text-3)' : 'var(--text)' }}>
              {r.mult === null ? 'Skip' : `${r.mult.toFixed(2)}×`}
            </div>
          </div>
        ))}
      </div>
      <Link href="/watchlist" style={{ display: 'inline-block', marginTop: '18px', fontSize: '13px', color: 'var(--teal)', textDecoration: 'none', fontWeight: 500 }}>
        Open the full watchlist →
      </Link>
    </div>
  )
}
