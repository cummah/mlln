'use client'

import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { dateCompact, pct } from '@/lib/signals/format'
import type { YtdData, YtdKey } from '@/lib/watchlist-ytd'

// Same colours as the watchlist page, so the two charts read as one thing.
const LINES: { key: YtdKey; label: string; color: string }[] = [
  { key: 'mlln', label: 'Enhanced DCA', color: '#0fa38b' },
  { key: 'std', label: 'Standard DCA', color: '#3987e5' },
  { key: 'spyDca', label: 'SPY, standard DCA', color: '#9085e9' },
]

const W = 560, H = 270, ML = 42, MR = 14, MT = 12, MB = 26

function niceStep(range: number): number {
  const raw = range / 4
  return [1, 2, 5, 10, 20, 25, 50, 100].find(s => s >= raw) ?? 100
}

const monthShort = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })

/** The Top 10 Watchlist since January: return on money invested, drawn in as the card scrolls into view. */
export function HeroChart({ ytd }: { ytd: YtdData }) {
  const reduce = useReducedMotion()
  const [hover, setHover] = useState<number | null>(null)
  const n = ytd.dates.length
  const last = n - 1
  const series = LINES.map(l => ytd.series.find(s => s.key === l.key)!.ret)

  const { lo, hi, ticks } = useMemo(() => {
    const all = series.flat().filter((v): v is number => v !== null)
    const min = Math.min(0, ...all), max = Math.max(0, ...all)
    const step = niceStep(max - min || 1)
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step
    const ticks: number[] = []
    for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v)
    return { lo, hi, ticks }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytd])

  const x = (i: number) => ML + (n === 1 ? 0 : (i / (n - 1)) * (W - ML - MR))
  const y = (v: number) => MT + (1 - (v - lo) / (hi - lo)) * (H - MT - MB)

  const paths = series.map(ret => {
    let d = ''
    ret.forEach((v, i) => { if (v !== null) d += `${d && ret[i - 1] !== null ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}` })
    return d
  })

  // Soft fill under the Enhanced DCA line, from its first value down to the zero line
  const firstIdx = series[0].findIndex(v => v !== null)
  const area = firstIdx >= 0 ? `${paths[0]}L${x(last).toFixed(1)},${y(0).toFixed(1)}L${x(firstIdx).toFixed(1)},${y(0).toFixed(1)}Z` : ''

  const monthTicks = ytd.dates.flatMap((d, i) => (i === 0 || d.slice(0, 7) !== ytd.dates[i - 1].slice(0, 7) ? [{ i, label: monthShort(d) }] : []))
  const shown = hover ?? last

  const at = (clientX: number, rect: DOMRect) => {
    const vx = ((clientX - rect.left) / rect.width) * W
    return Math.max(0, Math.min(last, Math.round(((vx - ML) / (W - ML - MR)) * last)))
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`Return on money invested since ${dateCompact(ytd.dates[0])}: ${LINES.map((l, k) => `${l.label} ${pct(series[k][last])}`).join(', ')}.`}
        style={{ display: 'block', touchAction: 'pan-y' }}
        onPointerMove={e => setHover(at(e.clientX, e.currentTarget.getBoundingClientRect()))}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="hero-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0fa38b" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#0fa38b" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map(t => (
          <g key={t}>
            <line x1={ML} x2={W - MR} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.07)'} strokeWidth={1} />
            <text x={ML - 8} y={y(t) + 4} textAnchor="end" fontSize={10.5} fill="#7e9ab5">{t > 0 ? '+' : ''}{t}%</text>
          </g>
        ))}
        {monthTicks.map(m => (
          <text key={m.i} x={x(m.i)} y={H - 8} fontSize={10.5} fill="#7e9ab5">{m.label}</text>
        ))}

        {area && (
          <motion.path
            d={area}
            fill="url(#hero-area)"
            initial={reduce ? false : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 1.4 }}
          />
        )}

        {/* Benchmarks first, Enhanced DCA last so it draws on top */}
        {[2, 1, 0].map(k => (
          <motion.path
            key={LINES[k].key}
            d={paths[k]}
            fill="none"
            stroke={LINES[k].color}
            strokeWidth={k === 0 ? 2.5 : 1.75}
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={reduce ? false : { pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.9, ease: 'easeInOut', delay: (2 - k) * 0.18 }}
          />
        ))}

        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={MT} y2={H - MB} stroke="rgba(255,255,255,0.35)" strokeWidth={1} />}

        {LINES.map((l, k) => {
          const v = series[k][shown]
          if (v === null) return null
          return (
            <g key={l.key}>
              {k === 0 && hover === null && (
                <circle cx={x(shown)} cy={y(v)} r={4} fill={l.color} className="lp-pulse" />
              )}
              <circle cx={x(shown)} cy={y(v)} r={4} fill={l.color} stroke="#0c1d2e" strokeWidth={2} />
            </g>
          )
        })}
      </svg>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '14px' }}>
        {LINES.map((l, k) => {
          const v = series[k][shown]
          return (
            <div key={l.key} style={{ borderTop: `2px solid ${l.color}`, paddingTop: '8px' }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '17px', fontWeight: 600, color: v === null ? 'var(--text-3)' : v >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {pct(v)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '2px' }}>{l.label}</div>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '12px' }}>
        {hover === null ? `Return on money invested, ${dateCompact(ytd.dates[0])} to ${dateCompact(ytd.dates[last])}` : dateCompact(ytd.dates[hover])}
      </div>
    </div>
  )
}
