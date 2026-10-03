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

interface ProOnlyWrapperProps {
  title: string
  subtitle: string
  children: React.ReactNode
  hiddenCount?: number
}

function ProOnlyWrapper({ title, subtitle, children, hiddenCount = 12 }: ProOnlyWrapperProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--teal)', flexShrink: 0 }} />
          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Live in this sector — pro only
          </span>
        </div>
        <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)', margin: '0 0 4px 0', letterSpacing: '-0.3px' }}>
          {title}
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: 0, lineHeight: '1.6' }}>
          {subtitle}
        </p>
      </div>

      {/* Content with Blur Effect */}
      <div style={{
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border-elevated)',
        borderRadius: '14px',
        padding: '20px',
        marginBottom: '12px',
        overflow: 'hidden',
        boxShadow: 'var(--inset-top), var(--shadow-md)'
      }}>
        {/* Wrap children to apply blur to table rows */}
        <div style={{ position: 'relative' }}>
          {children}
          {/* Blur overlay for rows after first 2 */}
          <style>{`
            table tbody tr:nth-child(n+3) {
              filter: blur(4px);
              opacity: 0.6;
            }
          `}</style>
        </div>
      </div>

      {/* Pro CTA Banner */}
      <div style={{
        background: '#1a1a1a',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>
            {hiddenCount} more signals hidden in this sector
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>
            Upgrade to Pro to see every ticker, date, and live return
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-2)' }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <button style={{
            padding: '10px 18px',
            background: 'var(--teal)',
            border: '1px solid var(--teal)',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: '600',
            color: '#000',
            cursor: 'pointer',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 196, 167, 0.9)';
            e.currentTarget.style.borderColor = 'rgba(0, 196, 167, 0.9)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--teal)';
            e.currentTarget.style.borderColor = 'var(--teal)';
          }}
          >
            Unlock all signals
          </button>
        </div>
      </div>
    </div>
  )
}

export function SectorPerformers({ sector }: SectorPerformersProps) {
  const [period, setPeriod] = useState<'1M' | '3M'>('1M')
  const [signalFrequency, setSignalFrequency] = useState<'weekly' | 'monthly'>('weekly')
  const [data, setData] = useState<PerformersData | null>(null)
  const [loading, setLoading] = useState(true)

  const DEFAULT_SETTINGS = {
    skeletonLoadersCount: 10,
    signalReasoningTruncateChars: 30,
    recentSignalsDaysWindow: 30,
    tableRowsLimit: 10,
  }
  const settings = data?.settings || DEFAULT_SETTINGS

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/sectors/${sector}/performers?period=${period}&signalFrequency=${signalFrequency}`)
        if (response.ok) {
          const json = await response.json()
          setData(json)
        } else {
          console.error('Failed to fetch performers:', response.status)
        }
      } catch (error) {
        console.error('Error fetching performers:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData().catch((err) => {
      console.error('Unhandled error in fetchData:', err)
    })
  }, [sector, period, signalFrequency])

  const oversoldHiddenCount = Math.max(0, (data?.oversold?.length || 0) - 2);
  const recentBuyZoneHiddenCount = Math.max(0, (data?.recentBuyZone?.length || 0) - 2);
  const topPerformersHiddenCount = Math.max(0, (data?.topPerformers?.length || 0) - 2);

  return (
    <div className="w-full" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Buy Opportunities Box */}
      <ProOnlyWrapper
        title="Recent signals fired in this sector"
        subtitle="Pro subscribers see every buy signal the moment it fires. Here's a sample of what's moved since — the rest are locked."
        hiddenCount={oversoldHiddenCount}
      >
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[...Array(settings.skeletonLoadersCount)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontWeight: '600', color: 'var(--text-2)' }}>
                    Ticker
                  </th>
                  <th style={{ textAlign: 'center', padding: '12px 8px', fontWeight: '600', color: 'var(--text-2)' }}>
                    Buy Multiplier
                  </th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', fontWeight: '600', color: 'var(--text-2)' }}>
                    DCA Suitability
                  </th>
                </tr>
              </thead>
              <tbody>
                {data?.oversold.map((asset) => (
                  <tr key={asset.ticker} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 8px' }}>
                      <Link href={`/dashboard/${asset.ticker.toLowerCase()}`}>
                        <div style={{ fontWeight: '500', color: 'var(--teal)', cursor: 'pointer', textDecoration: 'none' }}>{asset.ticker}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{asset.name}</div>
                      </Link>
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--green)', fontWeight: '600' }}>
                      {asset.signalMult.toFixed(2)}x
                    </td>
                    <td style={{ textAlign: 'right', padding: '12px 8px', fontWeight: '500', color: 'var(--text)' }}>
                      {(asset.dcaSuitabilityScore ?? 0).toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ProOnlyWrapper>

      {/* Recent Strong Signals Box */}
      <ProOnlyWrapper
        title="Signal-based returns"
        subtitle="Track assets by their return since their most recent buy signal fired. These show the impact of well-timed entries. Pro subscribers get alerts when new signals fire."
        hiddenCount={recentBuyZoneHiddenCount}
      >
        {/* Signal Frequency Toggle */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-2)' }}>Signals (1X+):</span>
          {[
            { id: 'weekly', label: 'Weekly' },
            { id: 'monthly', label: 'Monthly' },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setSignalFrequency(btn.id as 'weekly' | 'monthly')}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                background: signalFrequency === btn.id ? 'var(--surface2)' : 'transparent',
                border: signalFrequency === btn.id ? '1px solid var(--teal)' : '1px solid var(--border)',
                color: signalFrequency === btn.id ? 'var(--teal)' : 'var(--text-2)',
                transition: 'all 0.15s',
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[...Array(settings.skeletonLoadersCount)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : data?.recentBuyZone && data.recentBuyZone.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontWeight: '600', color: 'var(--text-2)' }}>
                    Ticker
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontWeight: '600', color: 'var(--text-2)' }}>
                    Signal Date
                  </th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', fontWeight: '600', color: 'var(--text-2)' }}>
                    Current % Return
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.recentBuyZone.map((entry) => (
                  <tr key={entry.ticker} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 8px' }}>
                      <Link href={`/dashboard/${entry.ticker.toLowerCase()}`}>
                        <div style={{ fontWeight: '500', color: 'var(--teal)', cursor: 'pointer', textDecoration: 'none' }}>{entry.ticker}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{entry.name}</div>
                      </Link>
                    </td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-2)' }}>{entry.signalDate}</td>
                    <td style={{ textAlign: 'right', padding: '12px 8px', fontWeight: '600', color: entry.currentReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {entry.currentReturn >= 0 ? '+' : ''}{entry.currentReturn.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: 'var(--text-2)', padding: '12px 8px' }}>
            No assets found with {signalFrequency === 'weekly' ? '2X+' : '1X+'} major buy signals in their history.
          </div>
        )}
      </ProOnlyWrapper>

      {/* Performance Analysis Section */}
      <ProOnlyWrapper
        title="Period-based rankings"
        subtitle="See which assets are leading the sector for the selected timeframe using Enhanced DCA returns. Different from signal-based returns — this shows overall performance for the period."
        hiddenCount={topPerformersHiddenCount}
      >
        {/* Period Toggle */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-2)' }}>Period:</span>
          {[
            { id: '1M', label: '1 Month' },
            { id: '3M', label: '3 Months' },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setPeriod(btn.id as '1M' | '3M')}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                background: period === btn.id ? 'var(--surface2)' : 'transparent',
                border: period === btn.id ? '1px solid var(--teal)' : '1px solid var(--border)',
                color: period === btn.id ? 'var(--teal)' : 'var(--text-2)',
                transition: 'all 0.15s',
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[...Array(settings.skeletonLoadersCount)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontWeight: '600', color: 'var(--text-2)' }}>
                    Rank
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px 8px', fontWeight: '600', color: 'var(--text-2)' }}>
                    Ticker
                  </th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', fontWeight: '600', color: 'var(--text-2)' }}>
                    {period} EDCA Return
                  </th>
                  <th style={{ textAlign: 'center', padding: '12px 8px', fontWeight: '600', color: 'var(--text-2)' }}>
                    Signal
                  </th>
                  <th style={{ textAlign: 'right', padding: '12px 8px', fontWeight: '600', color: 'var(--text-2)' }}>
                    DCA Suitability
                  </th>
                </tr>
              </thead>
              <tbody>
                {data?.topPerformers.map((performer, index) => (
                  <tr key={performer.ticker} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 8px', color: 'var(--text-2)' }}>{index + 1}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <Link href={`/dashboard/${performer.ticker.toLowerCase()}`}>
                        <div style={{ fontWeight: '500', color: 'var(--teal)', cursor: 'pointer', textDecoration: 'none' }}>{performer.ticker}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{performer.name}</div>
                      </Link>
                    </td>
                    <td style={{ textAlign: 'right', padding: '12px 8px', fontWeight: '600', color: performer.dcaReturnPct > 0 ? 'var(--green)' : 'var(--red)' }}>
                      {performer.dcaReturnPct > 0 ? '+' : ''}{performer.dcaReturnPct}%
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                      {performer.signalMult > 1.0 ? (
                        <span style={{ color: 'var(--green)', fontWeight: '600' }}>
                          buy {performer.signalMult.toFixed(1)}x
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-2)' }}>-</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', padding: '12px 8px', fontWeight: '500', color: 'var(--text)' }}>
                      {(performer.dcaSuitabilityScore ?? 0).toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ProOnlyWrapper>
    </div>
  )
}
