'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import type { TopPerformer, OversoldAsset, RecentBuyZoneEntry } from '@/lib/sector-queries'

interface PerformersData {
  topPerformers: TopPerformer[]
  oversold: OversoldAsset[]
  recentBuyZone: RecentBuyZoneEntry[]
  settings?: {
    skeletonLoadersCount: number
    signalReasoningTruncateChars: number
    recentSignalsDaysWindow: number
    tableRowsLimit: number
  }
}

interface SectorPerformersProps {
  sector: string
}

const DEFAULT_SETTINGS = {
  skeletonLoadersCount: 10,
  signalReasoningTruncateChars: 30,
  recentSignalsDaysWindow: 30,
  tableRowsLimit: 10,
}

const th = (align: 'left' | 'right' | 'center') => ({ textAlign: align, padding: '12px 8px', fontWeight: '600', color: 'var(--text-2)' }) as const
const NA = <span style={{ color: 'var(--text-3)' }}>n/a</span>

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '12px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)', margin: '0 0 4px 0', letterSpacing: '-0.3px' }}>{title}</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: 0, lineHeight: '1.6' }}>{subtitle}</p>
      </div>
      <div style={{
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border-elevated)',
        borderRadius: '14px',
        padding: '20px',
        overflow: 'hidden',
        boxShadow: 'var(--inset-top), var(--shadow-md)',
      }}>
        {children}
      </div>
    </div>
  )
}

function Loading({ count }: { count: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {[...Array(count)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '13px', color: 'var(--text-2)', padding: '12px 8px' }}>{children}</div>
}

function ShowAll({ shown, total, expanded, onToggle }: { shown: number; total: number; expanded: boolean; onToggle: () => void }) {
  if (total <= shown && !expanded) return null
  return (
    <button
      onClick={onToggle}
      style={{ marginTop: '10px', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-2)' }}
    >
      {expanded ? 'Show fewer' : `Show all ${total}`}
    </button>
  )
}

function TickerCell({ ticker, name }: { ticker: string; name: string }) {
  return (
    <Link href={`/asset/${ticker.toLowerCase()}`}>
      <div style={{ fontWeight: '500', color: 'var(--teal)', cursor: 'pointer', textDecoration: 'none' }}>{ticker}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{name}</div>
    </Link>
  )
}

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

export function SectorPerformers({ sector }: SectorPerformersProps) {
  const [period, setPeriod] = useState<'1M' | '3M'>('1M')
  const [signalFrequency, setSignalFrequency] = useState<'weekly' | 'monthly'>('weekly')
  const [data, setData] = useState<PerformersData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedRecent, setExpandedRecent] = useState(false)
  const [expandedSignals, setExpandedSignals] = useState(false)

  const settings = data?.settings || DEFAULT_SETTINGS
  const limit = settings.tableRowsLimit

  useEffect(() => {
    let live = true
    setLoading(true)
    setError(null)
    fetch(`/api/sectors/${sector}/performers?period=${period}&signalFrequency=${signalFrequency}`)
      .then(async r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(j => { if (live) setData(j) })
      .catch(e => { if (live) setError(String(e.message ?? e)) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [sector, period, signalFrequency])

  if (error) return <Empty>The sector rankings could not be loaded ({error}). Nothing is shown rather than showing something wrong.</Empty>

  const recent = data?.recentBuyZone ?? []
  const recentShown = expandedRecent ? recent : recent.slice(0, limit)
  const fired = data?.oversold ?? []
  const firedShown = expandedSignals ? fired : fired.slice(0, limit)

  return (
    <div className="w-full" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Recent signals */}
      <Section
        title="Recent signals fired in this sector"
        subtitle="Assets that received a weekly buy signal above 1× in the last 7 days. Strongest first, and where several are at the 6× maximum, the best DCA suitability first."
      >
        {loading ? <Loading count={settings.skeletonLoadersCount} /> : (data?.oversold?.length ?? 0) === 0 ? (
          <Empty>No weekly buy signals above 1× in this sector in the last 7 days.</Empty>
        ) : (
          <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={th('left')}>Ticker</th>
                  <th style={th('center')}>Buy Multiplier</th>
                  <th style={th('left')}>Why</th>
                  <th style={th('right')}>DCA Suitability</th>
                </tr>
              </thead>
              <tbody>
                {firedShown.map(asset => (
                  <tr key={asset.ticker} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 8px' }}><TickerCell ticker={asset.ticker} name={asset.name} /></td>
                    <td style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--green)', fontWeight: '600' }}>{asset.signalMult.toFixed(2)}x</td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-2)', fontSize: '12px' }}>{asset.signalReasoning}</td>
                    <td style={{ textAlign: 'right', padding: '12px 8px', fontWeight: '500', color: 'var(--text)' }}>
                      {asset.dcaSuitabilityScore === null ? NA : asset.dcaSuitabilityScore.toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ShowAll shown={limit} total={fired.length} expanded={expandedSignals} onToggle={() => setExpandedSignals(!expandedSignals)} />
          </>
        )}
      </Section>

      {/* Signal based returns */}
      <Section
        title="Signal-based returns"
        subtitle="Return since each asset's most recent buy signal of 1× or more, from the price the buy would have filled at. Pending means that price is not known yet, because it fills at the next open."
      >
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-2)' }}>Signals (1X+):</span>
          {([{ id: 'weekly', label: 'Weekly' }, { id: 'monthly', label: 'Monthly' }] as const).map(btn => (
            <button key={btn.id} onClick={() => { setSignalFrequency(btn.id); setExpandedRecent(false) }} style={pill(signalFrequency === btn.id)}>{btn.label}</button>
          ))}
        </div>

        {loading ? <Loading count={settings.skeletonLoadersCount} /> : recent.length > 0 ? (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={th('left')}>Ticker</th>
                    <th style={th('left')}>Signal Date</th>
                    <th style={th('right')}>Multiplier</th>
                    <th style={th('right')}>Current % Return</th>
                  </tr>
                </thead>
                <tbody>
                  {recentShown.map(entry => (
                    <tr key={entry.ticker} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 8px' }}><TickerCell ticker={entry.ticker} name={entry.name} /></td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-2)' }}>{entry.signalDate}</td>
                      <td style={{ textAlign: 'right', padding: '12px 8px', color: 'var(--text-2)' }}>{entry.signalMult.toFixed(2)}x</td>
                      <td style={{ textAlign: 'right', padding: '12px 8px', fontWeight: '600', color: entry.currentReturn === null ? 'var(--text-3)' : entry.currentReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {entry.currentReturn === null ? 'pending' : `${entry.currentReturn >= 0 ? '+' : ''}${entry.currentReturn.toFixed(1)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ShowAll shown={limit} total={recent.length} expanded={expandedRecent} onToggle={() => setExpandedRecent(!expandedRecent)} />
          </>
        ) : (
          <Empty>No assets in this sector have a {signalFrequency} buy signal of 1× or more in the recent past.</Empty>
        )}
      </Section>

      {/* Period based rankings */}
      <Section
        title="Period-based rankings"
        subtitle="See which assets are leading the sector for the selected timeframe using Enhanced DCA returns. Different from signal-based returns, this shows overall performance for the period."
      >
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-2)' }}>Period:</span>
          {([{ id: '1M', label: '1 Month' }, { id: '3M', label: '3 Months' }] as const).map(btn => (
            <button key={btn.id} onClick={() => setPeriod(btn.id)} style={pill(period === btn.id)}>{btn.label}</button>
          ))}
        </div>

        {loading ? <Loading count={settings.skeletonLoadersCount} /> : (data?.topPerformers?.length ?? 0) === 0 ? (
          <Empty>No assets in this sector have a {period === '1M' ? '1 month' : '3 month'} result yet.</Empty>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={th('left')}>Rank</th>
                  <th style={th('left')}>Ticker</th>
                  <th style={th('right')}>{period} EDCA Return</th>
                  <th style={th('center')}>Signal</th>
                  <th style={th('right')}>DCA Suitability</th>
                </tr>
              </thead>
              <tbody>
                {data!.topPerformers.map((performer, index) => (
                  <tr key={performer.ticker} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 8px', color: 'var(--text-2)' }}>{index + 1}</td>
                    <td style={{ padding: '12px 8px' }}><TickerCell ticker={performer.ticker} name={performer.name} /></td>
                    <td style={{ textAlign: 'right', padding: '12px 8px', fontWeight: '600', color: performer.dcaReturnPct > 0 ? 'var(--green)' : 'var(--red)' }}>
                      {performer.dcaReturnPct > 0 ? '+' : ''}{performer.dcaReturnPct}%
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                      {performer.signalMult > 1.0
                        ? <span style={{ color: 'var(--green)', fontWeight: '600' }}>buy {performer.signalMult.toFixed(1)}x</span>
                        : <span style={{ color: 'var(--text-2)' }}>-</span>}
                    </td>
                    <td style={{ textAlign: 'right', padding: '12px 8px', fontWeight: '500', color: 'var(--text)' }}>
                      {performer.dcaSuitabilityScore === null ? NA : performer.dcaSuitabilityScore.toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}
