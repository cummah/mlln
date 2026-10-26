'use client'

import { useMemo, useState } from 'react'
import { pct } from '@/lib/signals/format'
import type { YtdData, YtdKey } from '@/lib/watchlist-ytd'

const LINES: { key: YtdKey; label: string; color: string }[] = [
  { key: 'mlln', label: 'Enhanced DCA', color: '#0fa38b' },
  { key: 'std', label: 'Standard DCA', color: '#3987e5' },
  { key: 'spyDca', label: 'SPY, standard DCA', color: '#9085e9' },
]

const W = 320, H = 100, ML = 32, MR = 12, MT = 8, MB = 16

function niceStep(range: number): number {
  const raw = range / 4
  return [1, 2, 5, 10, 20, 25, 50, 100].find(s => s >= raw) ?? 100
}

export function MiniChart({ ytd, canAccess }: { ytd: YtdData; canAccess?: boolean }) {
  const [hover, setHover] = useState<number | null>(null)
  const n = ytd.dates.length
  const last = n - 1
  const series = LINES.map(l => ytd.series.find(s => s.key === l.key)!.ret)

  const { lo, hi } = useMemo(() => {
    const all = series.flat().filter((v): v is number => v !== null)
    const min = Math.min(0, ...all), max = Math.max(0, ...all)
    const step = niceStep(max - min || 1)
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step
    return { lo, hi }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytd])

  const x = (i: number) => ML + (n === 1 ? 0 : (i / (n - 1)) * (W - ML - MR))
  const y = (v: number) => MT + (1 - (v - lo) / (hi - lo)) * (H - MT - MB)

  const paths = series.map(ret => {
    let d = ''
    ret.forEach((v, i) => { if (v !== null) d += `${d && ret[i - 1] !== null ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}` })
    return d
  })

  // Soft fill under the Enhanced DCA line
  const firstIdx = series[0].findIndex(v => v !== null)
  const area = firstIdx >= 0 ? `${paths[0]}L${x(last).toFixed(1)},${y(0).toFixed(1)}L${x(firstIdx).toFixed(1)},${y(0).toFixed(1)}Z` : ''

  const shown = hover ?? last
  const opacity = canAccess ? 1 : 0.5

  return (
    <div style={{ width: '100%', opacity }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`Return comparison: ${LINES.map((l, k) => `${l.label} ${pct(series[k][last])}`).join(', ')}.`}
        style={{ display: 'block' }}
        onMouseMove={e => {
          const rect = e.currentTarget.getBoundingClientRect()
          const vx = ((e.clientX - rect.left) / rect.width) * W
          const idx = Math.max(0, Math.min(last, Math.round(((vx - ML) / (W - ML - MR)) * last)))
          setHover(idx)
        }}
        onMouseLeave={() => setHover(null)}
      >
        {/* Area under enhanced DCA line */}
        {area && (
          <path d={area} fill="#0fa38b" opacity="0.08" />
        )}

        {/* Grid lines */}
        <line x1={ML} y1={y(0)} x2={W - MR} y2={y(0)} stroke="var(--border)" strokeWidth="0.5" />

        {/* Lines */}
        {paths.map((d, idx) => (
          <path
            key={LINES[idx].key}
            d={d}
            fill="none"
            stroke={LINES[idx].color}
            strokeWidth="2"
            opacity={shown === undefined || Math.abs(idx - paths.findIndex(() => true)) < 2 ? 1 : 0.3}
            style={{ transition: 'opacity 0.2s' }}
          />
        ))}

        {/* Hover indicator */}
        {hover !== null && (
          <>
            <line x1={x(hover)} y1={MT} x2={x(hover)} y2={H - MB} stroke="var(--text-2)" strokeWidth="0.5" opacity="0.3" />
            <circle cx={x(hover)} cy={y(series[0][hover]!)} r="3" fill={LINES[0].color} />
            <circle cx={x(hover)} cy={y(series[1][hover]!)} r="3" fill={LINES[1].color} />
            <circle cx={x(hover)} cy={y(series[2][hover]!)} r="3" fill={LINES[2].color} />
          </>
        )}
      </svg>

      {/* Performance grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '12px' }}>
        {LINES.map((l, k) => {
          const v = series[k][shown]
          return (
            <div key={l.key} style={{ borderTop: `2px solid ${l.color}`, paddingTop: '6px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '15px', fontWeight: 600, color: v === null ? 'var(--text-3)' : v >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {pct(v)}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-2)', marginTop: '2px', lineHeight: 1.2 }}>{l.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
