'use client'

import type { CSSProperties, ReactNode } from 'react'
import { ATR_MULTIPLIERS, RANGES, type FreqSettings } from '@/lib/signals/config'
import { money, NA, num, pct, tone } from '@/lib/signals/format'
import type { Cohort, Stats } from '@/lib/signals/model'
import type { Strategy } from '@/lib/signals/types'
import { Card, Label, Segmented } from './ui'

const th = { padding: '8px 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-2)', textAlign: 'right', whiteSpace: 'nowrap' } as const
const td = { padding: '7px 10px', textAlign: 'right', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' } as const
const rowLabel = { padding: '7px 10px 7px 0', fontSize: '12px', color: 'var(--text-2)', textAlign: 'left' } as const
const dash = <span style={{ color: 'var(--text-3)' }}>-</span>

function Row({ label, hold, sell, spy, strong, hint }: { label: string; hold?: ReactNode; sell?: ReactNode; spy?: ReactNode; strong?: boolean; hint?: string }) {
  const cell = (v: ReactNode) => (
    <td style={{ ...td, fontWeight: strong ? 700 : 500, fontSize: strong ? '16px' : '13px' }}>{v === undefined ? dash : v}</td>
  )
  return (
    <tr style={{ borderTop: '1px solid var(--border)' }}>
      <td style={rowLabel} title={hint}>{label}</td>
      {cell(hold)}
      {cell(sell)}
      {cell(spy)}
    </tr>
  )
}

const signed = (v: number | null, f: (n: number) => string = n => money(n)): ReactNode =>
  v === null ? NA : <span style={{ color: tone(v) }}>{v >= 0 ? '+' : ''}{f(v)}</span>

interface ResultsProps {
  stats: Stats
  base: number
  strategy: Strategy
  setStrategy: (s: Strategy) => void
  settings: FreqSettings
}

/** Buy and hold, sell on exit signal and SPY side by side, with the sell rules directly beneath. */
export function Results({ stats, base, strategy, setStrategy, settings }: ResultsProps) {
  const h = stats.hold
  const s = stats.sell
  const spy = stats.spy
  const set = (patch: Partial<Strategy>) => setStrategy({ ...strategy, ...patch })
  const holdProfit = h.value - h.invested
  const vsHold = s.returnOnCapital !== null && h.returnPct !== null ? s.returnOnCapital - h.returnPct : null

  return (
    <Card pad={0}>
      <div style={{ padding: '14px 18px 0', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
          {stats.count.toLocaleString()} signals
          <span style={{ fontWeight: 400, color: 'var(--text-2)' }}> · {stats.avgMult === null ? NA : stats.avgMult.toFixed(2) + '×'} average multiplier · ${base} base per signal</span>
        </div>
        {stats.pending > 0 && (
          <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{stats.pending} signals from the latest day are left out until their entry price exists</div>
        )}
      </div>

      <div style={{ padding: '4px 18px 6px', overflowX: 'auto' }}>
        <table className="res-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left', paddingLeft: 0 }} />
              <th style={th}>Buy and hold</th>
              <th style={{ ...th, color: 'var(--teal)' }}>Sell on exit signal</th>
              <th style={th} title="The same dollars put into SPY on the same dates">SPY, same dollars</th>
            </tr>
          </thead>
          <tbody>
            <Row
              strong
              label="Return"
              hint="Buy and hold: on everything invested. Sell: on the cash actually needed, because sale proceeds are reused for later buys."
              hold={<span style={{ color: tone(h.returnPct) }}>{pct(h.returnPct)}</span>}
              sell={<span style={{ color: tone(s.returnOnCapital) }}>{pct(s.returnOnCapital)}</span>}
              spy={<span style={{ color: tone(spy.returnPct) }}>{pct(spy.returnPct)}</span>}
            />
            <Row
              label="Difference"
              hint="Buy and hold against SPY, and sell against buy and hold, in percentage points"
              hold={signed(spy.deltaPct, n => `${n.toFixed(1)} pts vs SPY`)}
              sell={signed(vsHold, n => `${n.toFixed(1)} pts vs hold`)}
            />
            <Row
              label="Cash needed"
              hint="Buy and hold funds every signal. Selling reuses sale proceeds, so less cash is needed."
              hold={money(h.invested)}
              sell={money(s.minCapital)}
              spy={money(spy.invested)}
            />
            <Row
              label="Profit"
              hint="Buy and hold: all unrealised gains/losses. Sell: realised gains from closed positions + unrealised from open positions. SPY: unrealised gains/losses."
              hold={signed(holdProfit)}
              sell={signed(s.profit)}
              spy={signed(spy.value - spy.invested)}
            />
            <Row
              label="Unrealised gains"
              hint="Buy and hold: gains from all held positions. Sell: gains from open positions only (closed positions counted in Profit)."
              hold={<span>{h.gainCount} positions · {signed(h.gains)}</span>}
              sell={<span>{s.openGainCount} positions · {signed(s.openGains)}</span>}
            />
            <Row
              label="Unrealised losses"
              hint="Buy and hold: losses from all held positions. Sell: losses from open positions only (closed positions counted in Profit)."
              hold={<span>{h.lossCount} positions · {signed(h.losses)}</span>}
              sell={<span>{s.openLossCount} positions · {signed(s.openLosses)}</span>}
            />
            <Row label="Current P&L" hold={money(h.value)} sell={money(s.endingValue)} spy={money(spy.value)} />
            <Row label="Win rate" hold={h.winRate === null ? NA : `${h.winRate.toFixed(0)}%`} sell={s.winRate === null ? NA : `${s.winRate.toFixed(0)}%`} />
            <Row label="Median return" hold={pct(h.medianPct)} sell={pct(s.medianPct)} />
            <Row label="Positions" hold={`${h.n.toLocaleString()} held`} sell={`${s.closedCount.toLocaleString()} sold · ${s.openCount.toLocaleString()} held`} />
            <Row label="Average days held when sold" sell={s.avgHoldDays === null ? NA : `${num(s.avgHoldDays, 0)} d`} />
            {strategy.atrIdx !== null && <Row label="Sold by signal / stop" sell={`${s.bySignal.toLocaleString()} / ${s.byAtr.toLocaleString()}`} />}
          </tbody>
        </table>
        <div style={{ fontSize: '10.5px', color: 'var(--text-3)', margin: '4px 0 10px', lineHeight: 1.4 }}>
          Hold side: gains {money(h.gains)} − losses {money(Math.abs(h.losses))} = Current P&L {money(h.value)}.
          <br />
          Sell side: minimum starting cash {money(s.minCapital)} + realised profit {money(s.closedProfit)} + unrealised gains {money(s.openGains)} − unrealised losses {money(Math.abs(s.openLosses))} = Current P&L {money(s.endingValue)}.
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface2)', borderRadius: '0 0 12px 12px', padding: '12px 18px 14px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--teal)', marginBottom: '8px' }}>Sell rules</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px' }}>
          <div>
            <Label right={`${strategy.minExit.toFixed(1)}${strategy.maxExit >= RANGES.exit[1] ? '+' : ` to ${strategy.maxExit.toFixed(1)}`}`}>Exit score</Label>
            <input type="range" min={2} max={RANGES.exit[1]} step={0.5} value={strategy.minExit} onChange={e => set({ minExit: Number(e.target.value) })} />
            <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '3px' }}>2 is the model&apos;s own exit threshold</div>
          </div>
          <div>
            <Label>Sell price</Label>
            <Segmented
              value={strategy.nextOpen ? 'open' : 'close'}
              onChange={v => set({ nextOpen: v === 'open' })}
              options={[{ key: 'close', label: 'Close' }, { key: 'open', label: 'Next open' }]}
            />
          </div>
          {settings.hasAtrStops && (
            <div>
              <Label right={strategy.atrIdx === null ? 'off' : `${ATR_MULTIPLIERS[strategy.atrIdx]}× ATR`}>Stop loss</Label>
              <input
                type="range" min={0} max={ATR_MULTIPLIERS.length} step={1}
                value={strategy.atrIdx === null ? 0 : strategy.atrIdx + 1}
                onChange={e => { const v = Number(e.target.value); set({ atrIdx: v === 0 ? null : v - 1 }) }}
              />
              <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '3px' }}>Below the highest close since the signal. First trigger wins.</div>
            </div>
          )}
          <div>
            <Label right={`$${strategy.fee}`}>Fee per sale</Label>
            <input type="range" min={0} max={20} step={1} value={strategy.fee} onChange={e => set({ fee: Number(e.target.value) })} />
          </div>
        </div>
      </div>
    </Card>
  )
}

export function CohortChart({ data, unit }: { data: Cohort[]; unit: string }) {
  if (data.length === 0) return null
  const max = Math.max(...data.flatMap(d => [Math.abs(d.holdPct ?? 0), Math.abs(d.sellPct ?? 0)]), 5)
  const bar = (v: number | null, strong: boolean) => {
    const h = v === null ? 0 : Math.max(3, (Math.abs(v) / max) * 90)
    return <div style={{ flex: 1, height: `${h}px`, background: v !== null && v >= 0 ? 'var(--green)' : '#E24B4A', opacity: strong ? 0.9 : 0.45, borderRadius: '3px 3px 0 0' }} />
  }
  const swatch = (opacity: number) => (
    <span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--green)', opacity, marginRight: 5, borderRadius: 2 }} />
  )
  return (
    <Card pad={0}>
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Return by {unit} of signal</div>
          <div style={{ fontSize: '11px', color: 'var(--text-2)', display: 'flex', gap: '12px' }}>
            <span>{swatch(0.9)}Buy and hold</span>
            <span>{swatch(0.45)}Sell on exit signal</span>
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-3)', margin: '2px 0 14px' }}>Dollar weighted return to the latest close, for the signals issued in each {unit}.</div>
        <div className="cohort-scroll" style={{ overflowX: 'auto' }}>
        <div className="cohort-inner" style={{ '--n': data.length } as CSSProperties}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '112px' }}>
          {data.map(d => (
            <div key={d.key} title={`${d.label}: held ${pct(d.holdPct)}, sold ${pct(d.sellPct)}, ${d.signals} signals`} style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '2px', minWidth: 0 }}>
              {bar(d.holdPct, true)}
              {bar(d.sellPct, false)}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
          {data.map(d => (
            <div key={d.key} style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
              <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{d.label}</div>
              <div style={{ fontSize: '9.5px', fontWeight: 600, color: tone(d.holdPct) }}>{pct(d.holdPct)}</div>
              <div style={{ fontSize: '9.5px', color: tone(d.sellPct), opacity: 0.7 }}>{pct(d.sellPct)}</div>
              <div style={{ fontSize: '9px', color: 'var(--text-3)' }}>{d.signals.toLocaleString()}</div>
            </div>
          ))}
        </div>
        </div>
        </div>
        <style dangerouslySetInnerHTML={{ __html: cohortCss }} />
      </div>
    </Card>
  )
}

// Phones: each cohort keeps a readable width and the chart scrolls sideways inside its card.
const cohortCss = `
  @media (max-width: 767px) {
    .cohort-inner { min-width: calc(var(--n) * 44px); }
    .res-table { min-width: 460px; }
  }
`
