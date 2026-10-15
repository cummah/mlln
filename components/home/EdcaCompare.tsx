'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { RANK_WINDOWS, type RankWindow } from '@/lib/rank/config'
import { pct } from '@/lib/signals/format'
import type { AssetGroup, HomeData, UniverseStats } from '@/lib/home-data'
import { CountUp } from './Motion'

const WORDS: Record<RankWindow, string> = { '1y': '1 year', '3y': '3 years', '5y': '5 years' }
const GROUPS: { key: AssetGroup; label: string }[] = [
  { key: 'all', label: 'All assets' },
  { key: 'stock', label: 'Stocks' },
  { key: 'etf', label: 'ETFs' },
]
const STD = '#3987e5'
const ENH = '#0fa38b'

const tone = (v: number | null) => (v === null ? 'var(--text-3)' : v >= 0 ? 'var(--green)' : 'var(--red)')

function Bar({ value, max, color, delay }: { value: number | null; max: number; color: string; delay: number }) {
  const reduce = useReducedMotion()
  const w = value === null ? 0 : Math.max(value, 0) / max
  return (
    <div style={{ height: '9px', background: 'var(--surface2)', borderRadius: '5px', overflow: 'hidden' }}>
      <motion.div
        style={{ height: '100%', background: color, borderRadius: '5px' }}
        initial={reduce ? false : { width: 0 }}
        animate={{ width: `${w * 100}%` }}
        transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  )
}

/** Standard DCA against Enhanced DCA on the top ranked assets, with the whole-universe average beside it. */
export function EdcaCompare({ top, universe }: { top: HomeData['top']; universe: UniverseStats }) {
  const [win, setWin] = useState<RankWindow>('3y')
  const rows = top[win]
  const max = Math.max(1, ...rows.flatMap(a => [a.cells[win].std ?? 0, a.cells[win].enh ?? 0]))
  const avg = universe.avgAlpha[win]
  const beat = universe.beatShare[win]

  return (
    <div>
    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '20px' }} className="lp-compare">
      <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '16px', padding: '22px 24px', boxShadow: 'var(--shadow-md), var(--inset-top)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-2)' }}>
            <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: STD, marginRight: '6px' }} />Standard DCA</span>
            <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: ENH, marginRight: '6px' }} />Enhanced DCA</span>
          </div>
          <div role="tablist" aria-label="Time window" style={{ display: 'flex', background: 'var(--surface2)', borderRadius: '8px', padding: '3px' }}>
            {RANK_WINDOWS.map(w => (
              <button
                key={w}
                role="tab"
                aria-selected={win === w}
                onClick={() => setWin(w)}
                style={{
                  border: 'none', cursor: 'pointer', padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                  background: win === w ? 'var(--teal)' : 'transparent', color: win === w ? 'var(--bg)' : 'var(--text-2)', transition: 'background 0.2s, color 0.2s',
                }}
              >
                {WORDS[w]}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {rows.map((a, i) => {
            const c = a.cells[win]
            return (
              <Link key={a.ticker} href={`/asset/${a.ticker}`} style={{ textDecoration: 'none', display: 'grid', gridTemplateColumns: '64px 1fr 86px', gap: '14px', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{a.ticker}</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-3)' }}>Rank #{a.rank}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <Bar value={c.std} max={max} color={STD} delay={i * 0.04} />
                  <Bar value={c.enh} max={max} color={ENH} delay={i * 0.04 + 0.08} />
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: '12px', lineHeight: 1.5 }}>
                  <div style={{ color: 'var(--text-2)' }}>{pct(c.std, 0)}</div>
                  <div style={{ color: tone(c.enh), fontWeight: 600 }}>{pct(c.enh, 0)}</div>
                </div>
              </Link>
            )
          })}
        </div>
        <div style={{ marginTop: '18px', paddingTop: '12px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-3)', lineHeight: 1.5 }}>
          Monthly plan, return on money invested over {WORDS[win]}. The ten assets with the highest standard DCA return, so these are the strongest for plain DCA, not a typical result. Backtests do not predict the future.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '22px 24px', flex: 1 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
            Across all {universe.count.toLocaleString('en-US')} assets, {WORDS[win]}
          </div>
          <div style={{ fontSize: '40px', fontWeight: 700, letterSpacing: '-0.03em', marginTop: '12px', color: tone(avg) }}>
            {avg === null ? 'n/a' : <CountUp key={`a${win}`} value={avg} decimals={1} suffix=" pts" signed />}
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-2)', marginTop: '4px' }}>average Enhanced minus Standard DCA</div>
          <div style={{ height: '1px', background: 'var(--border)', margin: '20px 0' }} />
          <div style={{ fontSize: '40px', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)' }}>
            {beat === null ? 'n/a' : <CountUp key={`b${win}`} value={beat * 100} suffix="%" />}
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-2)', marginTop: '4px' }}>of assets where Enhanced beat Standard</div>
        </div>
        <Link href="/rank" style={{ fontSize: '13px', color: 'var(--teal)', textDecoration: 'none', fontWeight: 500 }}>
          See every asset ranked →
        </Link>
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '20px' }}>
      {GROUPS.map(g => {
        const st = universe.beat[win][g.key]
        const share = st.total ? Math.round((st.beats / st.total) * 100) : null
        return (
          <div key={g.key} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px 24px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{g.label}: beat standard DCA</div>
            <div style={{ fontSize: '40px', fontWeight: 700, letterSpacing: '-0.03em', marginTop: '10px', color: 'var(--text)' }}>{share === null ? 'n/a' : `${share}%`}</div>
            <div style={{ fontSize: '14px', color: 'var(--text-2)', marginTop: '2px' }}>{st.beats.toLocaleString('en-US')} of {st.total.toLocaleString('en-US')}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>of assets with a {WORDS[win]} result</div>
          </div>
        )
      })}
    </div>
    </div>
  )
}
