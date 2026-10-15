'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { dateCompact } from '@/lib/signals/format'
import { LockedCell } from '@/components/gating/LockedCell'
import type { RecentBuyZoneEntry } from '@/lib/sector-queries'
import type { Entitlement } from '@/types'
import { SignalCell } from './SignalCell'
import { SortTh, sortBy, useSort } from './sorting'

interface SignalsData {
  weekly: RecentBuyZoneEntry[]
  monthly: RecentBuyZoneEntry[]
  settings?: { skeletonLoadersCount: number; tableRowsLimit: number }
}

type Frequency = 'weekly' | 'monthly'
type SortKey = 'ticker' | 'date' | 'mult' | 'ret'

const MULT_CHIPS = [1, 2, 4, 6] as const
const DEFAULT_LIMIT = 15

const pill = (active: boolean) => ({
  padding: '5px 12px',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: '600',
  cursor: 'pointer',
  background: active ? 'var(--surface2)' : 'transparent',
  border: active ? '1px solid var(--teal)' : '1px solid var(--border)',
  color: active ? 'var(--teal)' : 'var(--text-2)',
  transition: 'all 0.15s',
}) as const

const label = { fontSize: '13px', fontWeight: '600', color: 'var(--text-2)' } as const

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '13px', color: 'var(--text-2)', padding: '12px 8px' }}>{children}</div>
}

export function SectorSignalsTable({ sector }: { sector: string }) {
  const [frequency, setFrequency] = useState<Frequency>('weekly')
  const [minMult, setMinMult] = useState<number>(4)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [data, setData] = useState<SignalsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [entitlement, setEntitlement] = useState<Entitlement>({ tier: 0, assets: new Set() })
  const [latestDate, setLatestDate] = useState<string | null>(null)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const sort = useSort<SortKey>('date', 'desc', ['ticker'])

  useEffect(() => {
    let live = true
    fetch(`/api/sectors/${sector}/signals`)
      .then(async r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(j => {
        if (live) {
          setData(j)
          // Determine latest date from all signals
          const allDates = [...(j.weekly ?? []), ...(j.monthly ?? [])].map(r => r.signalDate)
          if (allDates.length > 0) {
            setLatestDate(allDates.sort().reverse()[0])
          }
        }
      })
      .catch(e => { if (live) setError(String(e.message ?? e)) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [sector])

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

  const limit = data?.settings?.tableRowsLimit ?? DEFAULT_LIMIT
  const periods = frequency === 'weekly' ? 'weeks' : 'months'

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = (data?.[frequency] ?? []).filter(r =>
      r.signalMult >= minMult && (!q || r.ticker.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)))
    return sortBy(filtered, sort.key, sort.dir, (r, k) =>
      k === 'ticker' ? r.ticker : k === 'date' ? r.signalDate : k === 'mult' ? r.signalMult : r.currentReturn)
  }, [data, frequency, minMult, query, sort.key, sort.dir])

  if (error) return <Empty>The sector signals could not be loaded ({error}). Nothing is shown rather than showing something wrong.</Empty>

  const shown = expanded ? rows : rows.slice(0, limit)
  const assets = new Set(rows.map(r => r.ticker)).size
  const returns = rows.map(r => r.currentReturn).filter((x): x is number => x !== null).sort((a, b) => a - b)
  const median = returns.length ? (returns.length % 2 ? returns[(returns.length - 1) / 2] : (returns[returns.length / 2 - 1] + returns[returns.length / 2]) / 2) : null
  const avgMult = rows.length ? rows.reduce((t, r) => t + r.signalMult, 0) / rows.length : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: '0 0 12px 0', lineHeight: '1.6' }}>
        Every buy signal fired in this sector over the latest 3 {periods}, one row per signal, with the return since the price each buy would have filled at. Click a column heading to sort. Pending means that price is not known yet, because it fills at the next open.
      </p>
      <div style={{
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border-elevated)',
        borderRadius: '14px',
        padding: '20px',
        overflow: 'hidden',
        boxShadow: 'var(--inset-top), var(--shadow-md)',
      }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={label}>Signals:</span>
          {(['weekly', 'monthly'] as const).map(f => (
            <button key={f} onClick={() => { setFrequency(f); setExpanded(false) }} style={pill(frequency === f)}>{f === 'weekly' ? 'Weekly' : 'Monthly'}</button>
          ))}
          <span style={{ ...label, marginLeft: '12px' }}>Multiplier:</span>
          {MULT_CHIPS.map(m => (
            <button key={m} onClick={() => { setMinMult(m); setExpanded(false) }} style={pill(minMult === m)}>{m}×{m === 6 ? '' : '+'}</button>
          ))}
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setExpanded(false) }}
            placeholder="Search ticker or name"
            aria-label="Search ticker or name"
            style={{ marginLeft: 'auto', padding: '5px 10px', borderRadius: '6px', fontSize: '12px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', minWidth: '180px' }}
          />
        </div>

        {!loading && rows.length > 0 && (
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '16px', fontSize: '13px', color: 'var(--text-2)' }}>
            <span><strong style={{ color: 'var(--text)' }}>{rows.length}</strong> {rows.length === 1 ? 'signal' : 'signals'} across <strong style={{ color: 'var(--text)' }}>{assets}</strong> {assets === 1 ? 'asset' : 'assets'}</span>
            {avgMult !== null && <span>Average multiplier <strong style={{ color: 'var(--text)' }}>{avgMult.toFixed(2)}x</strong></span>}
            {median !== null && <span>Median return since signal <strong style={{ color: median >= 0 ? 'var(--green)' : 'var(--red)' }}>{median >= 0 ? '+' : ''}{median.toFixed(1)}%</strong></span>}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <Empty>No {frequency} buy signals of {minMult}× or more{query ? ` matching "${query}"` : ''} in the latest 3 {periods}.{minMult > 1 && !query ? ' Try a lower multiplier.' : ''}</Empty>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <SortTh label="Ticker" col="ticker" sort={sort} />
                    <SortTh label="Signal Date" col="date" sort={sort} />
                    <SortTh label="Multiplier" col="mult" sort={sort} align="right" />
                    <SortTh label="Return Since Signal" col="ret" sort={sort} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map(r => {
                    const isLatestPeriod = latestDate && (frequency === 'weekly'
                      ? r.signalDate === latestDate
                      : r.signalDate.slice(0, 7) === latestDate.slice(0, 7))
                    const canAccess = entitlement.tier >= 2 || (entitlement.tier === 1 && entitlement.assets.has(r.ticker))
                    const isLocked = isLatestPeriod && !canAccess

                    return (
                    <tr key={`${r.ticker}-${r.signalDate}`} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 8px' }}>
                        {isLocked ? (
                          <LockedCell onUpgradeClick={() => setShowUpgrade(true)} />
                        ) : (
                          <Link href={`/asset/${r.ticker.toLowerCase()}`}>
                            <div style={{ fontWeight: '500', color: 'var(--teal)', cursor: 'pointer' }}>{r.ticker}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{r.name}</div>
                          </Link>
                        )}
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-2)' }}>{dateCompact(r.signalDate)}</td>
                      <td style={{ textAlign: 'right', padding: '12px 8px' }}><SignalCell mult={r.signalMult} /></td>
                      <td style={{ textAlign: 'right', padding: '12px 8px', fontWeight: '600', color: r.currentReturn === null ? 'var(--text-3)' : r.currentReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {r.currentReturn === null ? 'pending' : `${r.currentReturn >= 0 ? '+' : ''}${r.currentReturn.toFixed(1)}%`}
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {(rows.length > limit || expanded) && (
              <button
                onClick={() => setExpanded(!expanded)}
                style={{ marginTop: '10px', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)' }}
              >
                {expanded ? 'Show fewer' : `Show all ${rows.length}`}
              </button>
            )}
          </>
        )}
      </div>

      {showUpgrade && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', padding: '24px', maxWidth: '400px', boxShadow: 'var(--shadow-lg)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', margin: '0 0 8px 0' }}>Upgrade to view latest signals</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              The latest signal period is only available to premium subscribers. Upgrade your plan to see the most recent buy signals.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowUpgrade(false)} style={{ flex: 1, padding: '10px 16px', background: 'var(--surface)', border: '1px solid var(--border-elevated)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>Close</button>
              <Link href="/pricing" onClick={() => setShowUpgrade(false)} style={{ flex: 1, padding: '10px 16px', background: 'var(--teal)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#040e18', cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>View plans</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
