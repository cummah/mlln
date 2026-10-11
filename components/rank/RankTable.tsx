'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { RANK_WINDOWS, type RankData, type RankFreq, type RankRow, type RankWindow } from '@/lib/rank/config'
import { NA, pct, tone } from '@/lib/signals/format'
import { Card, Chip, Label, Segmented, sliderCss } from '@/components/signals/ui'

const TOP_OPTIONS = [10, 25, 50, 100, 250, 500]
const WINDOW_LABEL: Record<RankWindow, string> = { '1y': '1 Year', '3y': '3 Years', '5y': '5 Years' }

type SortKey = 'rank' | 'ticker' | 'sector' | 'dca' | 'std' | 'enh' | 'alpha'

function band(score: number | null): { bg: string; fg: string; label: string } {
  if (score === null) return { bg: 'var(--surface2)', fg: 'var(--text-3)', label: '' }
  if (score >= 80) return { bg: 'rgba(40,217,126,0.16)', fg: 'var(--green)', label: 'Excellent' }
  if (score >= 60) return { bg: 'rgba(0,196,167,0.16)', fg: 'var(--teal)', label: 'Good' }
  if (score >= 40) return { bg: 'rgba(240,161,40,0.16)', fg: '#f0a128', label: 'Marginal' }
  if (score >= 20) return { bg: 'rgba(226,120,74,0.16)', fg: '#e2784a', label: 'Poor fit' }
  return { bg: 'rgba(226,75,74,0.16)', fg: '#E24B4A', label: 'Unsuitable' }
}

function ScorePill({ score }: { score: number | null }) {
  const b = band(score)
  return (
    <span title={b.label} style={{ display: 'inline-block', minWidth: '38px', textAlign: 'center', padding: '2px 9px', borderRadius: '12px', fontWeight: 700, fontFamily: 'DM Mono, monospace', background: b.bg, color: b.fg }}>
      {score === null ? NA : score}
    </span>
  )
}

export function RankTable({ data }: { data: RankData }) {
  const [win, setWin] = useState<RankWindow>('5y')
  const [freq, setFreq] = useState<RankFreq>('weekly')
  const [type, setType] = useState<'' | 'stock' | 'etf'>('')
  const [sector, setSector] = useState('')
  const [topN, setTopN] = useState<number | null>(null)
  const [minScore, setMinScore] = useState(0)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [desc, setDesc] = useState(false)
  const [page, setPage] = useState(0)
  const pageSize = 100

  const sectors = useMemo(() => Array.from(new Set(data.rows.map(r => r.sector).filter(Boolean))).sort(), [data.rows])
  const cell = (r: RankRow) => r[freq][win]

  const shown = useMemo(() => {
    const q = search.trim().toUpperCase()
    let rows = data.rows.filter(r =>
      (!type || r.assetType === type) &&
      (!sector || r.sector === sector) &&
      (!q || r.ticker.toUpperCase().includes(q) || r.name.toUpperCase().includes(q)))
    // Top N means the N best DCA scores among the assets that match the other filters. Rows are already in rank order.
    if (topN !== null) rows = rows.slice(0, topN)
    if (minScore > 0) rows = rows.filter(r => r.dca !== null && r.dca >= minScore)

    const val = (r: RankRow): string | number | null => {
      switch (sortKey) {
        case 'rank': return r.rank
        case 'ticker': return r.ticker
        case 'sector': return r.sector
        case 'dca': return r.dca
        case 'std': return cell(r).std
        case 'enh': return cell(r).enh
        case 'alpha': return cell(r).alpha
      }
    }
    const dir = desc ? -1 : 1
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b)
      if (x === null && y === null) return 0
      if (x === null) return 1
      if (y === null) return -1
      return (x < y ? -1 : x > y ? 1 : 0) * dir
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.rows, type, sector, search, topN, minScore, sortKey, desc, win, freq])

  const stats = useMemo(() => {
    const alphas = shown.map(r => cell(r).alpha).filter((x): x is number => x !== null)
    const scores = shown.map(r => r.dca).filter((x): x is number => x !== null)
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
    return { avgAlpha: avg(alphas), beats: alphas.filter(a => a > 0).length, withAlpha: alphas.length, avgScore: avg(scores) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, win, freq])

  const pages = Math.max(1, Math.ceil(shown.length / pageSize))
  const cur = Math.min(page, pages - 1)
  const slice = shown.slice(cur * pageSize, (cur + 1) * pageSize)

  const head = (key: SortKey, label: string, align: 'left' | 'right' = 'right', hint?: string) => {
    const active = sortKey === key
    return (
      <th key={key} title={hint} onClick={() => { if (active) setDesc(!desc); else { setSortKey(key); setDesc(key !== 'rank' && key !== 'ticker' && key !== 'sector') } setPage(0) }}
        style={{ padding: '11px 14px', textAlign: align, fontWeight: 600, color: active ? 'var(--text)' : 'var(--text-2)', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
        {label}{active ? (desc ? ' ↓' : ' ↑') : ''}
      </th>
    )
  }

  const updated = data.updatedAt ? new Date(data.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : NA

  return (
    <div className="min-h-screen bg-[var(--bg)]" style={{ padding: '14px 18px 28px', width: '100%', maxWidth: '1360px', marginLeft: 'auto', marginRight: 'auto', overflowX: 'clip' }}>
      <nav style={{ fontSize: '12px', color: 'var(--text-2)', display: 'flex', gap: '6px', marginBottom: '12px' }}>
        <Link href="/sectors" style={{ color: 'var(--text-2)', textDecoration: 'none' }}>Assets</Link>
        <span>›</span>
        <span style={{ color: 'var(--text)' }}>Rank</span>
      </nav>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.2px' }}>DCA Rank</h1>
      <p style={{ fontSize: '12.5px', color: 'var(--text-2)', margin: '6px 0 14px', lineHeight: 1.55, maxWidth: '820px' }}>
        Assets ranked by DCA suitability score, 1 to 100. The score measures how well the enhanced strategy would have done on each asset compared with standard DCA over its past, so it describes history, not the future.
        Returns are to the latest close. Summary last built {updated}.
      </p>

      <Card pad={14} style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px 26px', alignItems: 'flex-end' }}>
          <div>
            <Label>Top by DCA score</Label>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <Chip active={topN === null} onClick={() => { setTopN(null); setPage(0) }}>All</Chip>
              {TOP_OPTIONS.map(n => <Chip key={n} active={topN === n} onClick={() => { setTopN(n); setPage(0) }}>Top {n}</Chip>)}
            </div>
          </div>
          <div style={{ minWidth: '190px' }}>
            <Label right={minScore === 0 ? 'any' : `${minScore}+`}>Minimum score</Label>
            <input type="range" min={0} max={100} step={5} value={minScore} onChange={e => { setMinScore(Number(e.target.value)); setPage(0) }} />
          </div>
          <div><Label>Window</Label><Segmented value={win} onChange={v => { setWin(v); setPage(0) }} options={RANK_WINDOWS.map(w => ({ key: w, label: WINDOW_LABEL[w] }))} /></div>
          <div><Label>Buying</Label><Segmented value={freq} onChange={setFreq} options={[{ key: 'weekly', label: 'Weekly' }, { key: 'monthly', label: 'Monthly' }]} /></div>
          <div><Label>Type</Label><Segmented value={type} onChange={v => { setType(v); setPage(0) }} options={[{ key: '', label: 'All' }, { key: 'stock', label: 'Stocks' }, { key: 'etf', label: 'ETFs' }]} /></div>
          <div>
            <Label>Sector</Label>
            <select value={sector} onChange={e => { setSector(e.target.value); setPage(0) }} style={{ padding: '7px 10px', background: 'var(--surface2)', border: '1px solid var(--border-elevated)', borderRadius: '8px', fontSize: '12px', color: 'var(--text)' }}>
              <option value="">All sectors</option>
              {sectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <Label>Search</Label>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder="Ticker or name" style={{ padding: '7px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--text)', width: '150px' }} />
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px', marginBottom: '12px' }}>
        <Card><div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Assets shown</div><div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)' }}>{shown.length.toLocaleString()}</div><div style={{ fontSize: '11px', color: 'var(--text-3)' }}>average DCA score {stats.avgScore === null ? NA : stats.avgScore.toFixed(0)}</div></Card>
        <Card><div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Average alpha</div><div style={{ fontSize: '24px', fontWeight: 700, color: tone(stats.avgAlpha) }}>{pct(stats.avgAlpha)}</div><div style={{ fontSize: '11px', color: 'var(--text-3)' }}>enhanced minus standard, in points</div></Card>
        <Card><div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Beat standard DCA</div><div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)' }}>{stats.beats.toLocaleString()} <span style={{ fontSize: '14px', color: 'var(--text-2)', fontWeight: 500 }}>of {stats.withAlpha.toLocaleString()}</span></div><div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{stats.withAlpha ? ((stats.beats / stats.withAlpha) * 100).toFixed(0) : 0}% of assets with a {WINDOW_LABEL[win].toLowerCase()} result</div></Card>
      </div>

      <Card pad={0} style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
              {head('rank', '#', 'left', 'Position by DCA score across every asset')}
              {head('ticker', 'Asset', 'left')}
              {head('sector', 'Sector', 'left')}
              {head('dca', 'DCA score', 'right', 'Enhanced DCA suitability, 1 to 100')}
              {head('std', 'Standard', 'right', `Standard DCA return over ${WINDOW_LABEL[win].toLowerCase()}`)}
              {head('enh', 'Enhanced', 'right', `Enhanced DCA return over ${WINDOW_LABEL[win].toLowerCase()}`)}
              {head('alpha', 'Alpha', 'right', 'Enhanced minus standard, in points')}
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => {
              const c = cell(r)
              return (
                <tr key={r.ticker} style={{ borderBottom: '1px solid var(--border)', background: i % 2 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                  <td style={{ padding: '10px 14px', color: 'var(--text-3)', fontFamily: 'DM Mono, monospace' }}>{r.rank}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <Link href={`/asset/${r.ticker.toLowerCase()}`} style={{ color: 'var(--teal)', fontWeight: 600, textDecoration: 'none' }} className="hover:underline">{r.ticker}</Link>
                    <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '2px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{r.sector}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}><ScorePill score={r.dca} /></td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', color: tone(c.std) }}>{pct(c.std)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', color: tone(c.enh) }}>{pct(c.enh)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 600, color: tone(c.alpha) }}>{pct(c.alpha)}</td>
                </tr>
              )
            })}
            {slice.length === 0 && <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-2)' }}>No assets match these filters.</td></tr>}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{shown.length === 0 ? 0 : cur * pageSize + 1}-{Math.min((cur + 1) * pageSize, shown.length)} of {shown.length.toLocaleString()} assets · n/a means the asset has too little history for this window</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button disabled={cur === 0} onClick={() => setPage(cur - 1)} style={{ padding: '6px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '12px', cursor: 'pointer' }}>Prev</button>
            <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>Page {cur + 1} of {pages}</span>
            <button disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} style={{ padding: '6px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '12px', cursor: 'pointer' }}>Next</button>
          </div>
        </div>
      </Card>
      <style dangerouslySetInnerHTML={{ __html: sliderCss }} />
    </div>
  )
}
