'use client'

import { useMemo, useState } from 'react'
import type { Frequency } from '@/lib/portfolio-aggregate'
import type { Period } from '@/types'

interface PerformanceData {
  period: Period
  cadence: Frequency
  stdReturn: number
  enhReturn: number
}

const W = 560, H = 270, ML = 42, MR = 14, MT = 12, MB = 26

const LINES = [
  { key: 'std', label: 'Standard DCA', color: '#3987e5' },
  { key: 'enh', label: 'Enhanced DCA', color: '#0fa38b' },
]

function niceStep(range: number): number {
  const raw = range / 4
  return [1, 2, 5, 10, 20, 25, 50, 100].find(s => s >= raw) ?? 100
}

const drawCss = `
  @media (min-width: 901px) and (prefers-reduced-motion: no-preference) {
    .perf-line { stroke-dasharray: 1; animation: perf-draw 1.9s ease-in-out both; }
    .perf-area { animation: perf-fade 1s ease-out 1.4s both; }
  }
  @keyframes perf-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
  @keyframes perf-fade { from { opacity: 0; } to { opacity: 1; } }
`

export function PortfolioPerformanceChart({ data }: { data: PerformanceData[] }) {
  const [hover, setHover] = useState<number | null>(null)
  // Data already ordered: 1Y on left, 5Y on right
  const reversed = [...data]
  const n = reversed.length
  const last = n - 1
  const series = [reversed.map(d => d.stdReturn), reversed.map(d => d.enhReturn)]

  const { lo, hi, ticks } = useMemo(() => {
    const all = series.flat()
    const min = Math.min(0, ...all), max = Math.max(0, ...all)
    const step = niceStep(max - min || 1)
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step
    const ticks: number[] = []
    for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v)
    return { lo, hi, ticks }
  }, [series])

  const x = (i: number) => ML + (n === 1 ? 0 : (i / (n - 1)) * (W - ML - MR))
  const y = (v: number) => MT + (1 - (v - lo) / (hi - lo)) * (H - MT - MB)

  const paths = series.map(ret => {
    let d = ''
    ret.forEach((v, i) => { d += `${d && ret[i - 1] !== null ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}` })
    return d
  })

  const area = `${paths[1]}L${x(last).toFixed(1)},${y(0).toFixed(1)}L${x(0).toFixed(1)},${y(0).toFixed(1)}Z`

  const shown = hover ?? last
  const windowLabel = (d: PerformanceData) => `${d.period === '1y' ? '1Y' : d.period === '3y' ? '3Y' : '5Y'} ${d.cadence === 'weekly' ? 'W' : 'M'}`

  const at = (clientX: number, rect: DOMRect) => {
    const vx = ((clientX - rect.left) / rect.width) * W
    return Math.max(0, Math.min(last, Math.round(((vx - ML) / (W - ML - MR)) * last)))
  }

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: drawCss }} />
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label="Portfolio return comparison"
        style={{ display: 'block', touchAction: 'pan-y' }}
        onPointerMove={e => setHover(at(e.clientX, e.currentTarget.getBoundingClientRect()))}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="perf-area" x1="0" x2="0" y1="0" y2="1">
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

        {reversed.map((d, i) => (
          <text key={i} x={x(i)} y={H - 8} fontSize={10.5} fill="#7e9ab5">{windowLabel(d)}</text>
        ))}

        <path d={area} fill="url(#perf-area)" className="perf-area" />

        {/* Standard DCA first, Enhanced DCA last so it draws on top */}
        {[0, 1].map(k => (
          <path
            key={LINES[k].key}
            d={paths[k]}
            pathLength={1}
            fill="none"
            stroke={LINES[k].color}
            strokeWidth={k === 1 ? 2.5 : 1.75}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="perf-line"
            style={{ animationDelay: `${k * 0.18}s` }}
          />
        ))}

        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={MT} y2={H - MB} stroke="rgba(255,255,255,0.35)" strokeWidth={1} />}

        {LINES.map((l, k) => {
          const v = series[k][shown]
          return (
            <g key={l.key}>
              {k === 1 && hover === null && (
                <circle cx={x(shown)} cy={y(v)} r={4} fill={l.color} className="lp-pulse" />
              )}
              <circle cx={x(shown)} cy={y(v)} r={4} fill={l.color} stroke="#0c1d2e" strokeWidth={2} />
            </g>
          )
        })}
      </svg>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '14px' }}>
        {LINES.map((l, k) => {
          const v = series[k][shown]
          return (
            <div key={l.key} style={{ borderTop: `2px solid ${l.color}`, paddingTop: '8px' }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '17px', fontWeight: 600, color: v >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {v >= 0 ? '+' : ''}{v.toFixed(1)}%
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '2px' }}>{l.label}</div>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '12px' }}>
        {windowLabel(reversed[shown])}
      </div>
    </div>
  )
}
