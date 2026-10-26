'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { dateCompact } from '@/lib/signals/format'
import type { YtdData, YtdKey, YtdTotals } from '@/lib/watchlist-ytd'

// Series colours are the dark steps of the validated categorical palette, in order, checked against the page surface.
// Teal is the brand accent, stepped into the palette's lightness band so it clears the same gates as the others.
const SERIES: Record<YtdKey, { label: string; short: string; color: string }> = {
  mlln: { label: 'mlln plan', short: 'mlln plan', color: '#0fa38b' },
  std: { label: 'Standard DCA, same assets', short: 'Standard DCA', color: '#3987e5' },
  spyMirror: { label: 'SPY, same dollars as mlln', short: 'SPY, same dollars', color: '#d95926' },
  spyDca: { label: 'SPY standard DCA', short: 'SPY standard DCA', color: '#9085e9' },
}
const KEYS: YtdKey[] = ['mlln', 'std', 'spyMirror', 'spyDca']
const SURFACE = '#0c1d2e'

const usdWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const signedUsd = (v: number) => `${v >= 0 ? '+' : '-'}${usdWhole.format(Math.abs(v))}`
const pct = (v: number | null) => (v === null ? '-' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`)
const pts = (v: number | null) => (v === null ? '-' : `${v >= 0 ? '+' : ''}${v.toFixed(1)} pts`)
const tone = (v: number | null) => (v === null ? 'var(--text-3)' : v >= 0 ? 'var(--green)' : 'var(--red)')
const retOf = (t: YtdTotals | null) => (t && t.invested > 0 ? (t.value / t.invested - 1) * 100 : null)
const diff = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b)

const card = {
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border-elevated)',
  borderRadius: '14px',
  padding: '20px',
  boxShadow: 'var(--inset-top), var(--shadow-md)',
} as const

const th = { textAlign: 'right', padding: '10px 8px', fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap' } as const

function niceStep(range: number): number {
  const raw = range / 5
  return [1, 2, 5, 10, 20, 25, 50, 100].find(s => s >= raw) ?? 100
}

const monthShort = (d: string) =>
  new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })

// ─── Line chart ─────────────────────────────────────────────────────────────────────────────

const W = 960, H = 320, ML = 52, MR = 16, MT = 12, MB = 28

function Chart({ ytd }: { ytd: YtdData }) {
  const [hover, setHover] = useState<number | null>(null)
  const n = ytd.dates.length
  const last = n - 1

  const { lo, hi, ticks } = useMemo(() => {
    const all = ytd.series.flatMap(s => s.ret).filter((v): v is number => v !== null)
    const min = Math.min(0, ...all), max = Math.max(0, ...all)
    const step = niceStep(max - min || 1)
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step
    const ticks: number[] = []
    for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v)
    return { lo, hi, ticks }
  }, [ytd.series])

  const x = (i: number) => ML + (n === 1 ? 0 : (i / (n - 1)) * (W - ML - MR))
  const y = (v: number) => MT + (1 - (v - lo) / (hi - lo)) * (H - MT - MB)

  const paths = ytd.series.map(s => {
    let d = ''
    s.ret.forEach((v, i) => { if (v !== null) d += `${d && s.ret[i - 1] !== null ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}` })
    return d
  })

  const monthTicks = ytd.dates.flatMap((d, i) => (i === 0 || d.slice(0, 7) !== ytd.dates[i - 1].slice(0, 7) ? [{ i, label: monthShort(d) }] : []))

  const at = (clientX: number, rect: DOMRect) => {
    const vx = ((clientX - rect.left) / rect.width) * W
    return Math.max(0, Math.min(last, Math.round(((vx - ML) / (W - ML - MR)) * last)))
  }

  const tipLeft = hover === null ? 0 : (x(hover) / W) * 100
  const flip = tipLeft > 60

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        tabIndex={0}
        aria-label={`Return on money invested since ${dateCompact(ytd.dates[0])}. ${KEYS.map(k => `${SERIES[k].label} ${pct(ytd.series.find(s => s.key === k)!.ret[last])}`).join(', ')}. The same figures are in the table below.`}
        style={{ display: 'block', touchAction: 'pan-y', outlineOffset: '4px' }}
        onPointerMove={e => setHover(at(e.clientX, e.currentTarget.getBoundingClientRect()))}
        onPointerLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        onKeyDown={e => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); setHover(h => Math.max(0, (h ?? last) - 1)) }
          else if (e.key === 'ArrowRight') { e.preventDefault(); setHover(h => Math.min(last, (h ?? last) + 1)) }
          else if (e.key === 'Escape') setHover(null)
        }}
      >
        {ticks.map(t => (
          <g key={t}>
            <line x1={ML} x2={W - MR} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.07)'} strokeWidth={1} />
            <text x={ML - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#7e9ab5">{t > 0 ? '+' : ''}{t}%</text>
          </g>
        ))}
        {monthTicks.map(m => (
          <text key={m.i} x={x(m.i)} y={H - 8} textAnchor="start" fontSize={11} fill="#7e9ab5">{m.label}</text>
        ))}

        {/* The three benchmarks first, mlln last so it draws on top */}
        {[...KEYS].reverse().map(k => {
          const idx = KEYS.indexOf(k)
          return <path key={k} d={paths[idx]} fill="none" stroke={SERIES[k].color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        })}

        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={MT} y2={H - MB} stroke="rgba(255,255,255,0.35)" strokeWidth={1} />}

        {/* End dots, and the dots under the pointer, with a surface ring so they stay legible where lines cross */}
        {KEYS.map((k, idx) => {
          const i = hover ?? last
          const v = ytd.series[idx].ret[i]
          return v === null ? null : <circle key={k} cx={x(i)} cy={y(v)} r={4} fill={SERIES[k].color} stroke={SURFACE} strokeWidth={2} />
        })}
      </svg>

      {hover !== null && (
        <div
          style={{
            position: 'absolute', top: 8, left: `${tipLeft}%`, transform: flip ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
            background: 'var(--surface)', border: '1px solid var(--border-elevated)', borderRadius: '8px', padding: '10px 12px',
            boxShadow: 'var(--shadow-md)', pointerEvents: 'none', minWidth: '210px', fontSize: '12px',
          }}
        >
          <div style={{ color: 'var(--text-2)', marginBottom: '6px' }}>{dateCompact(ytd.dates[hover])}</div>
          {KEYS.map((k, idx) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0' }}>
              <span style={{ width: '14px', height: 0, borderTop: `2px solid ${SERIES[k].color}`, flexShrink: 0 }} />
              <strong style={{ color: 'var(--text)', minWidth: '52px' }}>{pct(ytd.series[idx].ret[hover])}</strong>
              <span style={{ color: 'var(--text-2)' }}>{SERIES[k].short}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Section ────────────────────────────────────────────────────────────────────────────────

function Tile({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div style={{ ...card, padding: '14px 16px', flex: '1 1 220px' }}>
      <div style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 600, color: color ?? 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '4px' }}>{sub}</div>
    </div>
  )
}

export function YtdSection({ ytd, monthlyBase, startDate }: { ytd: YtdData; monthlyBase: number; startDate: string }) {
  // Returns do not depend on the base amount, only the dollar figures do, and they scale in proportion
  const k = ytd.baseAmount > 0 ? monthlyBase / ytd.baseAmount : 0
  const dollars = (t: YtdTotals) => ({ invested: t.invested * k, value: t.value * k })
  const ret = Object.fromEntries(KEYS.map(key => [key, retOf(ytd.totals[key])])) as Record<YtdKey, number | null>
  const vsStd = diff(ret.mlln, ret.std)
  const vsSpy = diff(ret.mlln, ret.spyMirror)
  const m = dollars(ytd.totals.mlln)

  const windowLabel = useMemo(() => {
    const start = new Date(startDate)
    const now = new Date()
    const years = (now.getTime() - start.getTime()) / (365.25 * 86400000)
    if (years >= 2.9) return `3-year rolling since ${dateCompact(startDate)}`
    if (years >= 1.9) return `2-year rolling since ${dateCompact(startDate)}`
    if (years >= 1) return `Year to date since ${dateCompact(startDate)}`
    return `Since ${dateCompact(startDate)}`
  }, [startDate])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text)', margin: '0 0 6px 0' }}>{windowLabel}</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: 0, lineHeight: 1.6, maxWidth: '820px' }}>
          How the monthly plan above has done, as return on the money put in, against three benchmarks. Standard DCA buys a flat {usdWhole.format(monthlyBase)} of every asset each month. The SPY lines put the same dollars into SPY, once on the days mlln bought and once as a flat monthly plan.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <Tile label={`mlln plan, ${windowLabel.split(' since')[0].toLowerCase()}`} value={pct(ret.mlln)} sub={`${usdWhole.format(m.invested)} in, worth ${usdWhole.format(m.value)} (${signedUsd(m.value - m.invested)})`} color={tone(ret.mlln)} />
        <Tile label="Versus standard DCA" value={pts(vsStd)} sub={`Standard DCA on the same assets: ${pct(ret.std)}`} color={tone(vsStd)} />
        <Tile label="Versus SPY, same dollars" value={pts(vsSpy)} sub={`SPY on the days mlln bought: ${pct(ret.spyMirror)}`} color={tone(vsSpy)} />
      </div>

      <div style={card}>
        <div style={{ display: 'flex', gap: '8px 20px', flexWrap: 'wrap', marginBottom: '12px', fontSize: '12px', color: 'var(--text-2)' }}>
          {KEYS.map(key => (
            <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '14px', height: 0, borderTop: `2px solid ${SERIES[key].color}` }} />
              {SERIES[key].label}
              <strong style={{ color: 'var(--text)' }}>{pct(ret[key])}</strong>
            </span>
          ))}
        </div>
        <Chart ytd={ytd} />
        <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '8px' }}>
          Return on the money invested to date, as of {dateCompact(ytd.asOf)}. Hover, or use the arrow keys, to read a day. Early in the year only a little has been invested, so those first weeks move a lot.
        </div>
      </div>

      <div style={card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ ...th, textAlign: 'left' }}>Plan</th>
                <th style={th}>Invested</th>
                <th style={th}>Worth now</th>
                <th style={th}>Gain</th>
                <th style={th}>Return on invested</th>
              </tr>
            </thead>
            <tbody>
              {KEYS.map(key => {
                const d = dollars(ytd.totals[key])
                return (
                  <tr key={key} style={{ borderBottom: '1px solid var(--border)', background: key === 'mlln' ? 'var(--teal-dim)' : 'transparent' }}>
                    <td style={{ padding: '10px 8px', color: 'var(--text)', fontWeight: key === 'mlln' ? 600 : 400 }}>
                      <span style={{ display: 'inline-block', width: '14px', borderTop: `2px solid ${SERIES[key].color}`, marginRight: '8px', verticalAlign: 'middle' }} />
                      {SERIES[key].label}
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 8px', color: 'var(--text-2)' }}>{usdWhole.format(d.invested)}</td>
                    <td style={{ textAlign: 'right', padding: '10px 8px', color: 'var(--text-2)' }}>{usdWhole.format(d.value)}</td>
                    <td style={{ textAlign: 'right', padding: '10px 8px', color: tone(d.value - d.invested) }}>{signedUsd(d.value - d.invested)}</td>
                    <td style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 600, color: tone(ret[key]) }}>{pct(ret[key])}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text)', margin: '0 0 12px 0' }}>By asset</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ ...th, textAlign: 'left' }}>Asset</th>
                <th style={th} title="Money the mlln plan put into this asset">Invested</th>
                <th style={th}>mlln</th>
                <th style={th}>Standard DCA</th>
                <th style={th} title="SPY bought on the same days and for the same dollars as the mlln buys in this asset">SPY, same dollars</th>
                <th style={th}>mlln vs standard DCA</th>
                <th style={th}>mlln vs SPY</th>
              </tr>
            </thead>
            <tbody>
              {ytd.perAsset.map(a => {
                const r = { mlln: retOf(a.mlln), std: retOf(a.std), spy: retOf(a.spyMirror) }
                const dStd = diff(r.mlln, r.std), dSpy = diff(r.mlln, r.spy)
                return (
                  <tr key={a.ticker} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 8px' }}>
                      <Link href={`/asset/${a.ticker.toLowerCase()}`} style={{ fontWeight: 500, color: 'var(--teal)' }}>{a.ticker}</Link>
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 8px', color: 'var(--text-2)' }}>{a.mlln ? usdWhole.format(a.mlln.invested * k) : '-'}</td>
                    <td style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 600, color: tone(r.mlln) }}>{pct(r.mlln)}</td>
                    <td style={{ textAlign: 'right', padding: '10px 8px', color: tone(r.std) }}>{pct(r.std)}</td>
                    <td style={{ textAlign: 'right', padding: '10px 8px', color: tone(r.spy) }}>{pct(r.spy)}</td>
                    <td style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 600, color: tone(dStd) }}>{pts(dStd)}</td>
                    <td style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 600, color: tone(dSpy) }}>{pts(dSpy)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: '12px 0 0 0', lineHeight: 1.6 }}>
          Price returns only: no dividends, fees or slippage. Each buy fills at the signal&apos;s entry price, and where there is no signal at the next open after the month&apos;s first trading day. An asset the plan never bought shows a dash. This is the list as of the start of 2026, run forward, and about ten months is a snapshot, not a track record.
        </p>
      </div>
    </div>
  )
}
