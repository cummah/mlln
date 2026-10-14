'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { pct } from '@/lib/signals/format'
import type { SectorHighlight } from '@/lib/home-data'

const R = 24
const C = 2 * Math.PI * R

function Tile({ s, i }: { s: SectorHighlight; i: number }) {
  const reduce = useReducedMotion()
  const share = s.total > 0 ? s.inZone / s.total : 0
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.6, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduce ? undefined : { y: -4 }}
    >
      <Link
        href={`/sectors/${s.slug}`}
        style={{
          display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 20px', textDecoration: 'none',
          background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '14px', boxShadow: 'var(--inset-top), var(--shadow-sm)',
        }}
      >
        <svg width="60" height="60" viewBox="0 0 60 60" role="img" aria-label={`${s.inZone} of ${s.total} assets at 4x or more`} style={{ flexShrink: 0 }}>
          <circle cx="30" cy="30" r={R} fill="none" stroke="var(--border)" strokeWidth="6" />
          <motion.circle
            cx="30" cy="30" r={R} fill="none" stroke="var(--green)" strokeWidth="6" strokeLinecap="round" transform="rotate(-90 30 30)"
            strokeDasharray={C}
            initial={reduce ? false : { strokeDashoffset: C }}
            whileInView={{ strokeDashoffset: C * (1 - share) }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, delay: 0.2 + i * 0.06, ease: 'easeOut' }}
          />
        </svg>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '3px' }}>
            <span style={{ color: s.inZone > 0 ? 'var(--green)' : 'var(--text-2)', fontWeight: 600 }}>{s.inZone}</span> of {s.total} at 4×+ today
          </div>
          <div style={{ fontSize: '11.5px', marginTop: '2px', color: s.return1M === null ? 'var(--text-3)' : s.return1M >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {pct(s.return1M)} <span style={{ color: 'var(--text-3)' }}>1M</span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

/** Which sectors have the most assets signalling a large buy right now. Every tile links to its sector page. */
export function SectorHighlights({ sectors }: { sectors: SectorHighlight[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
      {sectors.slice(0, 8).map((s, i) => (
        <Tile key={s.slug} s={s} i={i} />
      ))}
    </div>
  )
}
