'use client'

import type { CSSProperties, ReactNode } from 'react'
import { DualRangeSlider } from '@/components/ui/DualRangeSlider'

export const cardStyle: CSSProperties = {
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border-elevated)',
  borderRadius: '12px',
  boxShadow: 'var(--inset-top), var(--shadow-md)',
}

export function Card({ children, style, pad = 16 }: { children: ReactNode; style?: CSSProperties; pad?: number }) {
  return <div style={{ ...cardStyle, padding: pad, ...style }}>{children}</div>
}

export function Label({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-2)', letterSpacing: '0.04em' }}>{children}</span>
      {right && <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'DM Mono, monospace' }}>{right}</span>}
    </div>
  )
}

export function Chip({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: '7px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
        background: active ? 'var(--teal)' : 'var(--surface)',
        border: '1px solid ' + (active ? 'var(--teal)' : 'var(--border)'),
        color: active ? '#000' : 'var(--text)',
      }}
    >
      {children}
    </button>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { key: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '2px' }}>
      {options.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          style={{
            flex: 1, padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', border: 'none',
            background: value === o.key ? 'var(--teal)' : 'transparent',
            color: value === o.key ? '#040e18' : 'var(--text-2)',
            fontWeight: value === o.key ? 700 : 500,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function RangeRow({
  label, range, full, step = 1, onChange, show, note,
}: {
  label: string
  range: [number, number]
  full: [number, number]
  step?: number
  onChange: (r: [number, number]) => void
  show: (v: number) => string
  note?: string
}) {
  const narrowed = range[0] > full[0] || range[1] < full[1]
  return (
    <div title={note}>
      <Label right={narrowed ? `${show(range[0])} to ${show(range[1])}` : 'any'}>{label}</Label>
      <DualRangeSlider
        min={full[0]} max={full[1]} step={step} minValue={range[0]} maxValue={range[1]}
        onMinChange={v => onChange([v, range[1]])} onMaxChange={v => onChange([range[0], v])}
      />
    </div>
  )
}

export function Stat({ label, value, sub, color }: { label: string; value: ReactNode; sub?: ReactNode; color?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ color: 'var(--text-3)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 700, color: color ?? 'var(--text)', lineHeight: 1.1, fontFamily: 'DM Mono, monospace' }}>{value}</div>
      {sub && <div style={{ fontSize: '10.5px', color: 'var(--text-3)', marginTop: '3px', lineHeight: 1.35 }}>{sub}</div>}
    </div>
  )
}

export function Line({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12px', padding: '3px 0' }}>
      <span style={{ color: 'var(--text-2)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: color ?? 'var(--text)', fontFamily: 'DM Mono, monospace', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

export const sliderCss = `
  input[type='range'] { -webkit-appearance: none; appearance: none; width: 100%; height: 5px; background: var(--border); border-radius: 5px; outline: none; cursor: pointer; }
  input[type='range']::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%; background: #06768d; border: 2px solid #fff; cursor: pointer; }
  input[type='range']::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: #06768d; border: 2px solid #fff; cursor: pointer; }
  .dual-range input[type='range'] { position: absolute; top: 0; left: 0; width: 100%; height: 20px; margin: 0; background: transparent; pointer-events: none; }
  .dual-range input[type='range']::-webkit-slider-runnable-track { background: transparent; -webkit-appearance: none; }
  .dual-range input[type='range']::-moz-range-track { background: transparent; }
  .dual-range input[type='range']::-webkit-slider-thumb { pointer-events: auto; cursor: pointer; }
  .dual-range input[type='range']::-moz-range-thumb { pointer-events: auto; cursor: pointer; }
`
