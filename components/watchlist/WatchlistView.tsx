'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { dateCompact } from '@/lib/signals/format'
import { LockedCell } from '@/components/gating/LockedCell'
import type { DemoWatchlist, WatchFreq, WatchRow } from '@/lib/watchlist'
import type { Entitlement } from '@/types'
import { SignalCell } from '@/components/sectors/SignalCell'
import { SortTh, sortBy, useSort } from '@/components/sectors/sorting'
import { YtdSection } from './YtdSection'

type SortKey = 'ticker' | 'date' | 'mult' | 'amount' | 'ret'

const FREQ_WORD: Record<WatchFreq, { period: string; every: string }> = {
  weekly: { period: 'week', every: 'per week' },
  monthly: { period: 'month', every: 'per month' },
}

const usdWith = (digits: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits })
const usdCents = usdWith(2)
const usdWhole = usdWith(0)
const usd = (v: number) => usdCents.format(v)
const round2 = (v: number) => Math.round(v * 100) / 100

const monthLabel = (ym: string) =>
  new Date(`${ym}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) + " '" + ym.slice(2, 4)

const weekLabel = (weekKey: string) => {
  const [year, week] = weekKey.split('-W')
  return `W${week} '${year.slice(2, 4)}`
}

const canAccessTicker = (ticker: string, entitlement: Entitlement): boolean => {
  if (entitlement.tier >= 2) return true
  if (entitlement.tier === 1) return entitlement.assets.has(ticker)
  return false
}

const MaskedCell = ({ onUnlock }: { onUnlock?: () => void }) => (
  <span
    onClick={onUnlock}
    style={{ color: 'var(--text-2)', cursor: onUnlock ? 'pointer' : 'default', textDecoration: onUnlock ? 'underline' : 'none' }}
    title={onUnlock ? 'Click to upgrade' : undefined}
  >
    ••••
  </span>
)

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

const card = {
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border-elevated)',
  borderRadius: '14px',
  padding: '20px',
  boxShadow: 'var(--inset-top), var(--shadow-md)',
} as const

/** When the next signal should appear: a week or a month after the latest one. An estimate, the nightly job decides. */
function nextExpected(latest: string | null, freq: WatchFreq): string | null {
  if (!latest) return null
  const d = new Date(latest + 'T12:00:00Z')
  if (freq === 'weekly') d.setUTCDate(d.getUTCDate() + 7)
  else { d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(1) }
  return d.toISOString().slice(0, 10)
}

interface Line {
  row: WatchRow
  date: string
  mult: number
  ret: number | null
  amount: number
  shares: number | null
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ ...card, padding: '14px 16px', flex: '1 1 180px' }}>
      <div style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

export function WatchlistView({ data, maxMonths }: { data: DemoWatchlist; maxMonths?: number }) {
  const [freq, setFreqState] = useState<WatchFreq>('monthly')
  const setFreq = useCallback((f: WatchFreq) => setFreqState(f), [])
  const [amounts, setAmounts] = useState<Record<WatchFreq, string>>({
    weekly: String(data.baseAmount.weekly),
    monthly: String(data.baseAmount.monthly),
  })
  const [bought, setBought] = useState<Record<string, boolean>>({})
  const [entitlement, setEntitlement] = useState<Entitlement>({ tier: 0, assets: new Set() })
  const [showUpgrade, setShowUpgrade] = useState(false)
  const sort = useSort<SortKey>('amount', 'desc', ['ticker'])


  const word = FREQ_WORD[freq]
  const latest = data.latestDate[freq]
  const amountFor = (f: WatchFreq) => Math.max(0, Number(amounts[f]) || 0)
  const perAsset = amountFor(freq)
  const boughtKey = `mlln-demo-bought:${freq}:${latest ?? 'none'}`

  // Ticks are kept per list, frequency and period, so a new week or month starts with a clean list
  useEffect(() => {
    try { setBought(JSON.parse(localStorage.getItem(boughtKey) ?? '{}')) } catch { setBought({}) }
  }, [boughtKey])

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

  const toggleBought = (ticker: string) => {
    const next = { ...bought, [ticker]: !bought[ticker] }
    setBought(next)
    try { localStorage.setItem(boughtKey, JSON.stringify(next)) } catch { /* ticks just will not persist */ }
  }

  // Only assets with a signal in the latest period are listed, and each one is a buy of the base amount times its multiplier
  const lines: Line[] = useMemo(() => data.rows.flatMap(row => {
    const sig = row[freq]
    if (!sig || !sig.inLatestPeriod) return []
    const amount = round2(perAsset * sig.mult)
    return [{
      row,
      date: sig.date,
      mult: sig.mult,
      ret: sig.returnSince,
      amount,
      shares: amount > 0 && row.price ? amount / row.price : null,
    }]
  }), [data.rows, freq, perAsset])

  const sorted = useMemo(() => sortBy(lines, sort.key, sort.dir, (l, k) =>
    k === 'ticker' ? l.row.ticker : k === 'date' ? l.date : k === 'mult' ? l.mult : k === 'amount' ? l.amount : l.ret),
  [lines, sort.key, sort.dir])

  const total = round2(lines.reduce((t, l) => t + l.amount, 0))
  const biggest = lines.reduce<Line | null>((m, l) => (!m || l.amount > m.amount ? l : m), null)
  const doneCount = lines.filter(l => bought[l.row.ticker]).length
  const doneAmount = round2(lines.filter(l => bought[l.row.ticker]).reduce((t, l) => t + l.amount, 0))
  const next = nextExpected(latest, freq)

  // Historical distribution - monthly or weekly depending on freq
  const monthlyBase = amountFor('monthly')
  const weeklyBase = amountFor('weekly')
  const displayMonths = maxMonths ? data.months.slice(-maxMonths) : data.months

  // Generate week keys for weekly display
  const weekKeys = useMemo(() => {
    const keys: string[] = []
    if (!data.rows.length) return keys
    const allWeeks = new Set<string>()
    data.rows.forEach(row => {
      Object.keys(row.weeklyHistory).forEach(k => allWeeks.add(k))
    })
    return Array.from(allWeeks).sort()
  }, [data.rows])

  const grid = useMemo(() => {
    if (freq === 'weekly') {
      const displayWeeks = weekKeys.slice(-10) // rolling 10 weeks
      const cell = (mult: number | undefined) => (mult === undefined ? 0 : round2(weeklyBase * mult))
      const rows = data.rows.map(row => {
        const byWeek = displayWeeks.map(w => cell(row.weeklyHistory[w]))
        return { row, byWeek, total: round2(byWeek.reduce((a, b) => a + b, 0)), bought: byWeek.filter(v => v > 0).length }
      })
      const weekTotals = displayWeeks.map((_, i) => round2(rows.reduce((t, r) => t + r.byWeek[i], 0)))
      return { rows, periods: displayWeeks, periodLabels: displayWeeks.map(weekLabel), totals: weekTotals, grand: round2(weekTotals.reduce((a, b) => a + b, 0)), isWeekly: true }
    } else {
      const cell = (mult: number | undefined) => (mult === undefined ? 0 : round2(monthlyBase * mult))
      const rows = data.rows.map(row => {
        const byMonth = displayMonths.map(m => cell(row.history[m]))
        return { row, byMonth, total: round2(byMonth.reduce((a, b) => a + b, 0)), bought: byMonth.filter(v => v > 0).length }
      })
      const monthTotals = displayMonths.map((_, i) => round2(rows.reduce((t, r) => t + r.byMonth[i], 0)))
      return { rows, periods: displayMonths, periodLabels: displayMonths.map(monthLabel), totals: monthTotals, grand: round2(monthTotals.reduce((a, b) => a + b, 0)), isWeekly: false }
    }
  }, [data.rows, displayMonths, weekKeys, freq, monthlyBase, weeklyBase])

  const th = { textAlign: 'right', padding: '10px 8px', fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap' } as const

  return (
    <div style={{ maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto', padding: '24px 28px 40px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 500, color: 'var(--text)', margin: 0 }}>{data.name}</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-2)', margin: '6px 0 0 0', maxWidth: '620px', lineHeight: 1.6 }}>{data.description}</p>
        </div>
        <button
          disabled
          title="Custom watchlists are coming soon"
          style={{ ...pill(false), cursor: 'not-allowed', opacity: 0.6 }}
        >
          Create your own watchlist · soon
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-2)' }}>Signals:</span>
        {(['weekly', 'monthly'] as const).map(f => (
          <button key={f} onClick={() => setFreq(f)} style={pill(freq === f)}>{f === 'weekly' ? 'Weekly' : 'Monthly'}</button>
        ))}
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px', fontSize: '13px', fontWeight: 600, color: 'var(--text-2)' }}>
          Base amount per asset {word.every}
          <span style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: '6px', padding: '0 8px' }}>
            <span style={{ color: 'var(--text-3)' }}>$</span>
            <input
              type="number"
              min={0}
              step={1}
              value={amounts[freq]}
              onChange={e => setAmounts({ ...amounts, [freq]: e.target.value })}
              aria-label={`Base amount per asset ${word.every}`}
              style={{ width: '72px', padding: '5px 4px', fontSize: '13px', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)' }}
            />
          </span>
        </label>
        {perAsset !== data.baseAmount[freq] && (
          <button onClick={() => setAmounts({ ...amounts, [freq]: String(data.baseAmount[freq]) })} style={{ ...pill(false), fontWeight: 500 }}>
            Reset to {usdWhole.format(data.baseAmount[freq])}
          </button>
        )}
      </div>

      {!latest ? (
        <div style={{ ...card, color: 'var(--text-2)', fontSize: '13px' }}>
          <strong>No {freq} signals available yet.</strong> The latest {freq} signal date is not available. Check back later for {freq} signals, or switch to monthly.
        </div>
      ) : lines.length === 0 ? (
        <div style={{ ...card, color: 'var(--text-2)', fontSize: '13px' }}>
          None of these assets has a {freq} signal in the latest {word.period}. This means the model did not generate buy signals for any of these assets in the latest {word.period}.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Tile label={`To invest this ${word.period}`} value={usd(total)} sub={`Latest ${freq} signals, ${dateCompact(latest)}`} />
            <Tile label="Buying" value={`${lines.length} of ${data.rows.length}`} sub={data.rows.length > lines.length ? `${data.rows.length - lines.length} with no signal this ${word.period}` : 'Every asset has a signal'} />
            <Tile label="Biggest buy" value={biggest ? biggest.row.ticker : 'n/a'} sub={biggest ? `${usd(biggest.amount)} at ${biggest.mult.toFixed(2)}×` : undefined} />
          </div>

          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: 0, lineHeight: 1.6, maxWidth: '720px' }}>
                This {word.period}&apos;s signals only. Each is a buy of the base amount times the multiplier: under 1× is a smaller buy than usual, over 1× a bigger one. Tick each buy as you place it.
              </p>
              <div style={{ fontSize: '13px', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                <strong style={{ color: 'var(--text)' }}>{doneCount} of {lines.length}</strong> bought · {usd(doneAmount)} of {usd(total)}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ width: '36px' }} />
                    <SortTh label="Asset" col="ticker" sort={sort} />
                    <SortTh label="Signal Date" col="date" sort={sort} />
                    <SortTh label="Multiplier" col="mult" sort={sort} align="right" />
                    <SortTh label={`Buy this ${word.period}`} col="amount" sort={sort} align="right" />
                    <th style={{ ...th, padding: '12px 8px' }} title="Buy amount divided by the latest close">≈ Shares</th>
                    <SortTh label="Return Since Signal" col="ret" sort={sort} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(l => {
                    const done = !!bought[l.row.ticker]
                    const isLocked = !canAccessTicker(l.row.ticker, entitlement)
                    return (
                      <tr key={l.row.ticker} style={{ borderBottom: '1px solid var(--border)', opacity: done ? 0.55 : 1 }}>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <input type="checkbox" checked={done} onChange={() => toggleBought(l.row.ticker)} aria-label={`Mark ${l.row.ticker} as bought`} style={{ cursor: 'pointer' }} disabled={isLocked} />
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <Link href={`/asset/${l.row.ticker.toLowerCase()}`}>
                            <div style={{ fontWeight: 500, color: 'var(--teal)' }}>{l.row.ticker}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{l.row.name}</div>
                          </Link>
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-2)' }}>{dateCompact(l.date)}</td>
                        <td style={{ textAlign: 'right', padding: '12px 8px' }}>
                          {isLocked ? <MaskedCell onUnlock={() => setShowUpgrade(true)} /> : <SignalCell mult={l.mult} />}
                        </td>
                        <td style={{ textAlign: 'right', padding: '12px 8px', fontWeight: 600, color: 'var(--text)' }}>
                          {isLocked ? <MaskedCell onUnlock={() => setShowUpgrade(true)} /> : usd(l.amount)}
                        </td>
                        <td style={{ textAlign: 'right', padding: '12px 8px', color: 'var(--text-2)' }}>
                          {isLocked ? <MaskedCell onUnlock={() => setShowUpgrade(true)} /> : (l.shares === null ? '-' : l.shares.toFixed(l.shares >= 0.01 ? 3 : 5))}
                        </td>
                        <td style={{ textAlign: 'right', padding: '12px 8px', fontWeight: 600, color: l.ret === null ? 'var(--text-3)' : l.ret >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {l.ret === null ? 'pending' : `${l.ret >= 0 ? '+' : ''}${l.ret.toFixed(1)}%`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {next && (
              <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '12px' }}>
                Next {freq} signals expected around {dateCompact(next)}, after the nightly update.
              </div>
            )}
          </div>
        </>
      )}

      {freq === 'monthly' ? (
        data.ytd && <YtdSection ytd={data.ytd} monthlyBase={monthlyBase} startDate={data.startDate} />
      ) : (
        <div style={card}>
          <h2 style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text)', margin: '0 0 6px 0' }}>Weekly performance</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: '0 0 14px 0', lineHeight: 1.6, maxWidth: '820px' }}>
            Weekly performance tracking and comparison to benchmarks is coming soon. For now, you can see the allocation history above and the monthly performance below.
          </p>
        </div>
      )}

      {showUpgrade && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', padding: '24px', maxWidth: '400px', boxShadow: 'var(--shadow-lg)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', margin: '0 0 8px 0' }}>Upgrade to view latest allocation</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              The latest period allocation is only available to premium subscribers. Upgrade your plan to see the most recent buying recommendations.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowUpgrade(false)} style={{ flex: 1, padding: '10px 16px', background: 'var(--surface)', border: '1px solid var(--border-elevated)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>Close</button>
              <Link href="/pricing" onClick={() => setShowUpgrade(false)} style={{ flex: 1, padding: '10px 16px', background: 'var(--teal)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#040e18', cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>View plans</Link>
            </div>
          </div>
        </div>
      )}

      {grid.periods.length > 0 && (
        <div style={card}>
          <h2 style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text)', margin: '0 0 6px 0' }}>
            {freq === 'weekly' ? 'Weekly allocation (rolling 10 weeks)' : `Monthly allocation ${maxMonths ? `(last ${maxMonths} months)` : `since ${dateCompact(data.startDate)}`}`}
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: '0 0 14px 0', lineHeight: 1.6, maxWidth: '820px' }}>
            {freq === 'weekly'
              ? `What a weekly plan would have bought each week: ${usdWhole.format(weeklyBase)} base amount times that week's signal multiplier.`
              : `What a monthly plan would have bought each month: ${usdWhole.format(monthlyBase)} base amount times that month's signal multiplier.`}
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ ...th, textAlign: 'left' }}>Asset</th>
                  {grid.periodLabels.map((label, i) => <th key={grid.periods[i]} style={th}>{label}</th>)}
                  <th style={{ ...th, color: 'var(--text)' }}>Total</th>
                  <th style={th} title={`${freq === 'weekly' ? 'Weeks' : 'Months'} with a buy`}>Buys</th>
                </tr>
              </thead>
              <tbody>
                {grid.rows.map(r => {
                  const values = (grid.isWeekly ? (r as any).byWeek : (r as any).byMonth) || []
                  const isLatestLocked = grid.periods.length > 0 && !canAccessTicker(r.row.ticker, entitlement)
                  return (
                  <tr key={r.row.ticker} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 8px' }}>
                      <Link href={`/asset/${r.row.ticker.toLowerCase()}`} style={{ fontWeight: 500, color: 'var(--teal)' }}>{r.row.ticker}</Link>
                    </td>
                    {values.map((v: number, i: number) => {
                      const mult = grid.isWeekly ? r.row.weeklyHistory[grid.periods[i]] : r.row.history[grid.periods[i]]
                      const isLatest = i === grid.periods.length - 1
                      const isLocked = isLatest && isLatestLocked
                      return (
                        <td
                          key={grid.periods[i]}
                          title={mult === undefined ? `No signal this ${grid.isWeekly ? 'week' : 'month'}` : `${mult.toFixed(2)}×`}
                          style={{ textAlign: 'right', padding: '10px 8px', color: v > 0 ? 'var(--text)' : 'var(--text-3)', background: v > 0 ? 'var(--teal-dim)' : 'transparent', cursor: isLocked ? 'pointer' : 'default' }}
                          onClick={() => isLocked && setShowUpgrade(true)}
                        >
                          {isLocked ? <MaskedCell onUnlock={() => setShowUpgrade(true)} /> : (v > 0 ? usdWhole.format(v) : '-')}
                        </td>
                      )
                    })}
                    <td style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 600, color: 'var(--text)' }}>{r.total > 0 ? usdWhole.format(r.total) : '-'}</td>
                    <td style={{ textAlign: 'right', padding: '10px 8px', color: 'var(--text-2)' }}>{r.bought} of {grid.periods.length}</td>
                  </tr>
                  )
                })}
                <tr>
                  <td style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--text)' }}>Total</td>
                  {grid.totals.map((v, i) => {
                    const isLatest = i === grid.periods.length - 1
                    const isLocked = isLatest && grid.periods.length > 0 && !canAccessTicker('', entitlement)
                    return (
                      <td key={grid.periods[i]} style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 600, color: 'var(--text)', cursor: isLocked ? 'pointer' : 'default' }} onClick={() => isLocked && setShowUpgrade(true)}>
                        {isLocked ? <MaskedCell onUnlock={() => setShowUpgrade(true)} /> : (v > 0 ? usdWhole.format(v) : '-')}
                      </td>
                    )
                  })}
                  <td style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 700, color: 'var(--teal)' }}>{usdWhole.format(grid.grand)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
