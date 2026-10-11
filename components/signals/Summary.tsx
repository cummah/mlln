'use client'

import { ATR_MULTIPLIERS, RANGES, type FreqSettings } from '@/lib/signals/config'
import { money, num, pct, tone, NA } from '@/lib/signals/format'
import type { Cohort, Stats } from '@/lib/signals/model'
import type { Freq, Strategy } from '@/lib/signals/types'
import { Card, Label, Line, Segmented, Stat } from './ui'

export function Tiles({ stats, base }: { stats: Stats; base: number }) {
  const h = stats.hold
  const delta = stats.spy.deltaPct
  return (
    <Card pad={0}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '18px', padding: '16px 20px' }}>
        <Stat label="Signals" value={stats.count.toLocaleString()} sub={`${stats.avgMult === null ? NA : stats.avgMult.toFixed(2) + '×'} average multiplier${stats.pending ? ` · ${stats.pending} awaiting entry price` : ''}`} />
        <Stat label="Invested" value={money(h.invested)} sub={`$${base} base per signal`} />
        <Stat label="Value now" value={money(h.value)} sub={`${h.value - h.invested >= 0 ? '+' : ''}${money(h.value - h.invested)} profit`} color={tone(h.value - h.invested)} />
        <Stat
          label="Return, buy and hold"
          value={pct(h.returnPct)}
          color={tone(h.returnPct)}
          sub={stats.spy.returnPct === null ? 'SPY comparison unavailable' : <>Same dollars in SPY on the same dates: {pct(stats.spy.returnPct)}<br /><span style={{ color: tone(delta) }}>{delta === null ? '' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pts vs SPY`}</span></>}
        />
        <Stat label="Win rate" value={h.winRate === null ? NA : `${h.winRate.toFixed(0)}%`} sub={`${h.wins} of ${h.n} · median ${pct(h.medianPct)}`} />
      </div>
    </Card>
  )
}

interface StrategyProps {
  stats: Stats
  strategy: Strategy
  setStrategy: (s: Strategy) => void
  settings: FreqSettings
}

export function StrategyCard({ stats, strategy, setStrategy, settings }: StrategyProps) {
  const s = stats.sell
  const set = (patch: Partial<Strategy>) => setStrategy({ ...strategy, ...patch })
  const vsHold = s && s.returnOnCapital !== null && stats.hold.returnPct !== null ? s.returnOnCapital - stats.hold.returnPct : null
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)' }}>Strategy</div>
        <div style={{ minWidth: '260px' }}>
          <Segmented
            value={strategy.mode}
            onChange={mode => set({ mode })}
            options={[{ key: 'hold', label: 'Buy and hold' }, { key: 'sell', label: 'Sell on exit signal' }]}
          />
        </div>
      </div>

      {strategy.mode === 'hold' ? (
        <div style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.5 }}>
          Every signal is held to the latest close. Switch to <b>Sell on exit signal</b> to see what selling at the model&apos;s own exit signal would have done, and how much cash it would have needed.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <Label right={strategy.minExit >= 2 ? `${strategy.minExit.toFixed(1)}${strategy.maxExit >= RANGES.exit[1] ? '+' : ` to ${strategy.maxExit.toFixed(1)}`}` : ''}>Exit score</Label>
              <input type="range" min={2} max={RANGES.exit[1]} step={0.5} value={strategy.minExit} onChange={e => set({ minExit: Number(e.target.value) })} />
              <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '3px' }}>Sells when a later evaluation date scores at least this. 2 is the model&apos;s own threshold.</div>
            </div>
            <div>
              <Label>Sell price</Label>
              <Segmented value={strategy.nextOpen ? 'open' : 'close'} onChange={v => set({ nextOpen: v === 'open' })} options={[{ key: 'close', label: 'Exit day close' }, { key: 'open', label: 'Next open' }]} />
            </div>
            {settings.hasAtrStops && (
              <div>
                <Label right={strategy.atrIdx === null ? 'off' : `${ATR_MULTIPLIERS[strategy.atrIdx]}× ATR`}>Stop loss</Label>
                <input type="range" min={0} max={ATR_MULTIPLIERS.length} step={1} value={strategy.atrIdx === null ? 0 : strategy.atrIdx + 1} onChange={e => { const v = Number(e.target.value); set({ atrIdx: v === 0 ? null : v - 1 }) }} />
                <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '3px' }}>Sells if the close falls this many ATR(14) below the highest close since the signal. Whichever comes first wins.</div>
              </div>
            )}
            <div>
              <Label right={`$${strategy.fee}`}>Fee per sale</Label>
              <input type="range" min={0} max={20} step={1} value={strategy.fee} onChange={e => set({ fee: Number(e.target.value) })} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '26px', fontWeight: 700, color: tone(s?.returnOnCapital ?? null), fontFamily: 'DM Mono, monospace' }}>{pct(s?.returnOnCapital ?? null)}</span>
              {vsHold !== null && <span style={{ fontSize: '12px', fontWeight: 600, color: tone(vsHold) }}>{vsHold >= 0 ? '+' : ''}{vsHold.toFixed(1)} pts vs buy and hold</span>}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '8px' }}>return on the cash actually needed, because sale proceeds are reused for later buys</div>
            {s && (
              <>
                <Line label="Sold / still held" value={`${s.closedCount.toLocaleString()} / ${s.openCount.toLocaleString()}`} />
                {strategy.atrIdx !== null && <Line label="Sold by signal / stop" value={`${s.bySignal.toLocaleString()} / ${s.byAtr.toLocaleString()}`} />}
                <Line label="Realised profit" value={money(s.closedProfit)} color={tone(s.closedProfit)} />
                <Line label="Unrealised profit" value={money(s.openProfit)} color={tone(s.openProfit)} />
                <Line label="Average days held when sold" value={s.avgHoldDays === null ? NA : `${num(s.avgHoldDays, 0)} d`} />
                <Line label="Win rate" value={s.winRate === null ? NA : `${s.winRate.toFixed(0)}%`} />
                <div style={{ borderTop: '1px solid var(--border)', marginTop: '6px', paddingTop: '6px' }}>
                  <Line label="Minimum starting cash" value={money(s.minCapital)} />
                  <Line label="Ending value" value={money(s.endingValue)} />
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px', lineHeight: 1.4 }}>
                  Minimum starting cash + realised profit + unrealised profit = ending value ({money(s.minCapital)} + {money(s.closedProfit)} + {money(s.openProfit)} = {money(s.endingValue)}).
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

export function CohortChart({ data, freq, unit }: { data: Cohort[]; freq: Freq; unit: string }) {
  if (data.length === 0) return null
  const max = Math.max(...data.map(d => Math.abs(d.returnPct ?? 0)), 5)
  return (
    <Card pad={0}>
      <div style={{ padding: '18px 22px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Return by {unit} of signal</div>
        <div style={{ fontSize: '12px', color: 'var(--text-3)', margin: '2px 0 16px' }}>
          Dollar weighted return to the latest close of the signals issued in each {unit}. The number under each bar is how many signals it holds.
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '130px' }}>
          {data.map(d => {
            const v = d.returnPct
            const h = v === null ? 0 : Math.max(4, (Math.abs(v) / max) * 90)
            return (
              <div key={d.key} title={`${d.label}: ${pct(v)} on ${money(d.invested)} invested`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', minWidth: 0 }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: tone(v) }}>{pct(v)}</div>
                <div style={{ width: '100%', height: `${h}px`, background: v !== null && v >= 0 ? 'var(--green)' : '#E24B4A', opacity: 0.85, borderRadius: '4px 4px 0 0' }} />
                <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{d.label}</div>
                <div style={{ fontSize: '9.5px', color: 'var(--text-3)' }}>{d.signals.toLocaleString()}</div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
