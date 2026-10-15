'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { exportTableToCSV } from '@/lib/csv-export'
import { effective } from '@/lib/signals/model'
import { dateCompact, fracPct, mult, NA, num, money, pct, tone } from '@/lib/signals/format'
import type { Effective, Freq, SigRow, Strategy, TickerInfo } from '@/lib/signals/types'
import type { Entitlement } from '@/types'
import { Card } from './ui'
import { LockedCell } from '@/components/gating/LockedCell'

export interface TRow {
  r: SigRow
  t: TickerInfo
  eff: Effective
  invested: number
  pnl: number | null // held to the latest close
}

// pri 1 is always shown. Columns of pri 2 and 3 are dropped, in that order, when the table is narrow,
// so the table always fits its box and never scrolls sideways.
interface Col {
  key: string
  label: string
  pri: 1 | 2 | 3
  align: 'left' | 'right'
  sort: (x: TRow) => string | number | null
  cell: (x: TRow) => React.ReactNode
  csv: (x: TRow) => string | number | null
  only?: 'daily'
  hint?: string
  off?: boolean // hidden until chosen in the column picker
}

// A signal from the latest day has no entry price until the next open
const pendingCell = <span title="The entry price fills at the next open" style={{ color: 'var(--text-3)' }}>pending</span>

const soldRet = (x: TRow) => (x.eff.closed ? x.eff.retPct : null)

const COLS: Col[] = [
  {
    key: 'ticker', label: 'Asset', pri: 1, align: 'left', sort: x => x.t.ticker, csv: x => x.t.ticker,
    cell: x => (
      <>
        <Link href={`/asset/${x.t.ticker.toLowerCase()}`} onClick={e => e.stopPropagation()} style={{ color: 'var(--teal)', textDecoration: 'none', fontWeight: 600 }} className="hover:underline">{x.t.ticker}</Link>
        <div style={{ fontSize: '10.5px', color: 'var(--text-2)', marginTop: '1px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.t.name}</div>
      </>
    ),
  },
  { key: 'date', label: 'Signal', pri: 1, align: 'left', sort: x => x.r.d, csv: x => x.r.d, cell: x => dateCompact(x.r.d) },
  { key: 'mult', label: 'Mult', pri: 1, align: 'right', sort: x => x.r.m, csv: x => x.r.m, cell: x => mult(x.r.m), hint: 'Buy multiplier' },
  { key: 'pnl', label: 'P&L held', pri: 2, align: 'right', sort: x => x.pnl, csv: x => (x.pnl === null ? null : Math.round(x.pnl)), cell: x => (x.pnl === null ? pendingCell : <span style={{ color: tone(x.pnl), fontWeight: 600 }}>{money(x.pnl)}</span>), hint: 'Profit if held to the latest close' },
  { key: 'ret', label: 'Return held', pri: 1, align: 'right', sort: x => x.r.p, csv: x => x.r.p, cell: x => (x.r.p === null ? pendingCell : <span style={{ color: tone(x.r.p), fontWeight: 600 }}>{pct(x.r.p)}</span>), hint: 'Return if held to the latest close' },
  {
    key: 'sold', label: 'If sold', pri: 1, align: 'right', sort: soldRet,
    csv: x => (x.eff.closed ? x.eff.retPct : null),
    hint: 'Return if sold at the exit signal, or Held if no exit has happened',
    cell: x => x.eff.closed
      ? <span title={`Sold ${x.eff.date}${x.eff.reason === 'atr' ? ' by stop loss' : ''}`} style={{ color: tone(x.eff.retPct), fontWeight: 600 }}>{pct(x.eff.retPct)}{x.eff.reason === 'atr' ? ' ◦' : ''}</span>
      : <span style={{ color: 'var(--text-3)' }}>Held</span>,
  },
  { key: 'factor', label: 'Factor', pri: 2, align: 'right', sort: x => x.r.f, csv: x => x.r.f, cell: x => <span style={{ color: tone(x.r.f) }}>{fracPct(x.r.f)}</span>, hint: 'Factor regime' },
  // Vol timing exists only on down days. Up days have no value, shown as a dash.
  { key: 'vol', label: 'Vol timing', pri: 2, align: 'right', sort: x => x.r.v, csv: x => x.r.v, cell: x => (x.r.v === 0 ? <span style={{ color: 'var(--text-3)' }}>-</span> : <span style={{ color: tone(x.r.v) }}>{fracPct(x.r.v)}</span>), hint: 'Only on down days, a dash means the signal day was not a down day' },
  { key: 'mr', label: 'Mean rev', pri: 2, align: 'right', sort: x => x.r.r, csv: x => x.r.r, cell: x => <span style={{ color: tone(x.r.r) }}>{fracPct(x.r.r)}</span>, hint: 'Mean reversion' },
  { key: 'invested', label: 'Invested', pri: 3, align: 'right', sort: x => x.invested, csv: x => Math.round(x.invested), cell: x => money(x.invested) },
  { key: 'dca', label: 'DCA', pri: 3, align: 'right', sort: x => x.t.dca, csv: x => x.t.dca, cell: x => (x.t.dca === null ? NA : Math.round(x.t.dca)), hint: 'DCA suitability score' },
  { key: 'atr', label: 'Volat.', pri: 3, align: 'right', sort: x => x.r.a, csv: x => x.r.a, cell: x => (x.r.a === null ? NA : `${x.r.a.toFixed(1)}%`), hint: 'ATR(14) as a percent of price' },
  { key: 'sector', label: 'Sector', pri: 3, align: 'left', off: true, sort: x => x.t.sector, csv: x => x.t.sector, cell: x => x.t.sector },
  { key: 'exitScore', label: 'Exit score', pri: 3, align: 'right', off: true, sort: x => x.r.xs, csv: x => x.r.xs, cell: x => num(x.r.xs) },
  { key: 'wa', label: 'Wkly buy', pri: 3, align: 'right', only: 'daily', off: true, sort: x => x.r.wa, csv: x => x.r.wa, cell: x => (x.r.wa === null ? '-' : `${x.r.wa}d`), hint: 'Days since a weekly buy' },
  { key: 'ma', label: 'Mthly buy', pri: 3, align: 'right', only: 'daily', off: true, sort: x => x.r.ma, csv: x => x.r.ma, cell: x => (x.r.ma === null ? '-' : `${x.r.ma}d`), hint: 'Days since a monthly buy' },
]

const css = `
  .sig-wrap { container-type: inline-size; overflow-x: auto; }
  .sig-wrap .c2, .sig-wrap .c3 { display: none; }
  @container (min-width: 700px) { .sig-wrap .c2 { display: table-cell; } }
  @container (min-width: 880px) { .sig-wrap .c3 { display: table-cell; } }
`

// Phones get a card per signal instead of a wide table. Starts false so server and first client render match.
function useIsPhone() {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setPhone(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return phone
}

interface Props {
  rows: SigRow[]
  tickers: TickerInfo[]
  strategy: Strategy
  base: number
  freq: Freq
  onSelect: (r: SigRow) => void
  latestDate: string | null
  entitlement: Entitlement
}

const canAccess = (ticker: string, entitlement: Entitlement): boolean => {
  if (entitlement.tier >= 2) return true
  if (entitlement.tier === 1) return entitlement.assets.has(ticker)
  return false
}

const isLatestAndLocked = (row: TRow, latestDate: string | null, entitlement: Entitlement): boolean => {
  if (!latestDate) return false
  return row.r.d === latestDate && !canAccess(row.t.ticker, entitlement)
}

export function SignalTable({ rows, tickers, strategy, base, freq, onSelect, latestDate, entitlement }: Props) {
  const [sortKey, setSortKey] = useState('date')
  const [desc, setDesc] = useState(true)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(100)
  const [visible, setVisible] = useState<Set<string>>(new Set(COLS.filter(c => !c.off).map(c => c.key)))
  const [pickerOpen, setPickerOpen] = useState(false)
  const phone = useIsPhone()

  const available = COLS.filter(c => !c.only || c.only === freq)
  const cols = available.filter(c => visible.has(c.key))

  const trows = useMemo<TRow[]>(() => rows.map(r => ({
    r,
    t: tickers[r.i],
    eff: effective(r, strategy),
    invested: base * r.m,
    pnl: r.p === null ? null : base * r.m * (r.p / 100),
  })), [rows, tickers, strategy, base])

  const sorted = useMemo(() => {
    const col = COLS.find(c => c.key === sortKey) ?? COLS[1]
    const dir = desc ? -1 : 1
    return [...trows].sort((a, b) => {
      const x = col.sort(a), y = col.sort(b)
      if (x === null && y === null) return 0
      if (x === null) return 1 // missing values always last
      if (y === null) return -1
      return (x < y ? -1 : x > y ? 1 : 0) * dir
    })
  }, [trows, sortKey, desc])

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const cur = Math.min(page, pages - 1)
  const slice = sorted.slice(cur * pageSize, (cur + 1) * pageSize)

  const cls = (c: Col) => (c.pri === 1 ? undefined : `c${c.pri}`)
  const pad = '8px 9px'

  const btn = { padding: '7px 11px', background: 'var(--surface)', border: '1px solid var(--border-elevated)', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text)', cursor: 'pointer' } as const

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          {phone ? (
            <div style={{ display: 'flex', gap: '6px' }}>
              <select aria-label="Sort by" value={sortKey} onChange={e => { setSortKey(e.target.value); setDesc(true); setPage(0) }} style={{ ...btn, fontWeight: 500 }}>
                {available.filter(c => c.pri < 3 || c.key === sortKey).map(c => <option key={c.key} value={c.key}>Sort: {c.label}</option>)}
              </select>
              <button style={btn} aria-label={desc ? 'Descending' : 'Ascending'} onClick={() => { setDesc(!desc); setPage(0) }}>{desc ? '↓' : '↑'}</button>
            </div>
          ) : (
            <button style={btn} onClick={() => setPickerOpen(!pickerOpen)}>Columns</button>
          )}
          {pickerOpen && !phone && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '8px', padding: '10px 12px', minWidth: '200px', maxHeight: '320px', overflowY: 'auto', zIndex: 50, boxShadow: 'var(--shadow-lg)' }}>
              {available.map(c => (
                <label key={c.key} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '5px 0', fontSize: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={visible.has(c.key)} onChange={() => { const n = new Set(visible); if (n.has(c.key)) n.delete(c.key); else n.add(c.key); setVisible(n) }} />
                  {c.label}
                </label>
              ))}
              <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '6px', maxWidth: '190px' }}>On a narrow screen the less important columns are hidden so the table never scrolls sideways.</div>
            </div>
          )}
        </div>
        <button style={btn} onClick={() => {
          const unlockedRows = sorted.filter(x => !isLatestAndLocked(x, latestDate, entitlement))
          exportTableToCSV(unlockedRows.map(x => Object.fromEntries(available.map(c => [c.key, c.csv(x)]))), available.map(c => ({ key: c.key, label: c.label })), `${freq}-signals.csv`)
        }}>
          Export CSV
        </button>
        {!phone && <div style={{ fontSize: '12px', color: 'var(--text-3)', marginLeft: 'auto' }}>Click a row for the indicators behind it</div>}
      </div>

      <Card pad={0} style={{ overflow: 'hidden' }}>
        {phone ? (
          <div>
            {slice.map(x => {
              const locked = isLatestAndLocked(x, latestDate, entitlement)
              return (
              <div key={`${x.t.ticker}-${x.r.d}`} role="button" tabIndex={locked ? -1 : 0} onClick={() => !locked && onSelect(x.r)}
                onKeyDown={e => { if (!locked && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(x.r) } }}
                style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', cursor: locked ? 'default' : 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
                  <div style={{ minWidth: 0 }}>
                    {isLatestAndLocked(x, latestDate, entitlement) ? (
                      <div style={{ fontSize: '14px', fontWeight: 700 }}>
                        <LockedCell />
                      </div>
                    ) : (
                      <Link href={`/asset/${x.t.ticker.toLowerCase()}`} onClick={e => e.stopPropagation()} style={{ color: 'var(--teal)', textDecoration: 'none', fontWeight: 700, fontSize: '14px' }}>{x.t.ticker}</Link>
                    )}
                    <div style={{ fontSize: '11px', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.t.name}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, fontFamily: 'DM Mono, monospace', fontSize: '13px', color: 'var(--text)' }}>
                    {mult(x.r.m)}
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'inherit' }}>{dateCompact(x.r.d)}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', marginTop: '8px', fontFamily: 'DM Mono, monospace', fontSize: '12px' }}>
                  {(['pnl', 'ret', 'sold'] as const).map(k => {
                    const c = COLS.find(col => col.key === k)!
                    return (
                      <div key={k}>
                        <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'DM Sans, sans-serif', marginBottom: '1px' }}>{c.label}</div>
                        {c.cell(x)}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
            })}
            {slice.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-2)' }}>No signals match these filters.</div>}
          </div>
        ) : (
        <div className="sig-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                {cols.map(c => {
                  const active = sortKey === c.key
                  return (
                    <th key={c.key} className={cls(c)} title={c.hint}
                      onClick={() => { if (active) setDesc(!desc); else { setSortKey(c.key); setDesc(true) } setPage(0) }}
                      style={{ padding: pad, textAlign: c.align, fontWeight: 600, color: active ? 'var(--text)' : 'var(--text-2)', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
                      {c.label}{active ? (desc ? ' ↓' : ' ↑') : ''}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {slice.map((x, i) => {
                const locked = isLatestAndLocked(x, latestDate, entitlement)
                return (
                <tr key={`${x.t.ticker}-${x.r.d}`} onClick={() => !locked && onSelect(x.r)}
                  style={{ borderBottom: '1px solid var(--border)', background: i % 2 ? 'rgba(255,255,255,0.02)' : 'transparent', cursor: locked ? 'default' : 'pointer' }}
                  onMouseEnter={e => !locked && (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 ? 'rgba(255,255,255,0.02)' : 'transparent')}>
                  {cols.map(c => {
                    const locked = c.key === 'ticker' && isLatestAndLocked(x, latestDate, entitlement)
                    return (
                      <td key={c.key} className={cls(c)} style={{ padding: pad, textAlign: c.align, whiteSpace: 'nowrap', color: 'var(--text-2)', fontFamily: c.align === 'right' ? 'DM Mono, monospace' : undefined }}>
                        {locked ? <LockedCell /> : c.cell(x)}
                      </td>
                    )
                  })}
                </tr>
              )
              })}
              {slice.length === 0 && (
                <tr><td colSpan={cols.length} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-2)' }}>No signals match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>
            {sorted.length === 0 ? 0 : cur * pageSize + 1}-{Math.min((cur + 1) * pageSize, sorted.length)} of {sorted.length.toLocaleString()} signals
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0) }} style={{ padding: '6px 8px', background: 'var(--surface)', border: '1px solid var(--border-elevated)', borderRadius: '6px', color: 'var(--text)', fontSize: '12px' }}>
              {[50, 100, 250, 500].map(n => <option key={n} value={n}>{n} per page</option>)}
            </select>
            <button style={btn} disabled={cur === 0} onClick={() => setPage(cur - 1)}>Prev</button>
            <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>Page {cur + 1} of {pages}</span>
            <button style={btn} disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Next</button>
          </div>
        </div>
      </Card>
      <style dangerouslySetInnerHTML={{ __html: css }} />
    </div>
  )
}
