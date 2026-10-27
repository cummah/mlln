'use client'

import { useState } from 'react'
import { ATR_MULTIPLIERS, RANGES, type FreqSettings } from '@/lib/signals/config'
import type { Filters, Strategy } from '@/lib/signals/types'
import { Card, Chip, Label, RangeRow } from './ui'

interface Props {
  settings: FreqSettings
  filters: Filters
  setFilters: (f: Filters) => void
  base: number
  setBase: (n: number) => void
  datePreset: number | null
  setDatePreset: (d: number | null) => void
  sectors: string[]
  years: number[]
  strategy: Strategy
  setStrategy: (s: Strategy) => void
  onReset: () => void
  onSave?: () => void
  onUpgrade?: () => void
  isSaving?: boolean
  userTier?: number
  saveMessage?: string
}

const NA_NOTE = 'Signals with no value for this indicator are hidden only while this is narrowed.'

export function FilterRail({ settings, filters, setFilters, base, setBase, datePreset, setDatePreset, sectors, years, strategy, setStrategy, onReset, onSave, onUpgrade, isSaving, userTier = 0, saveMessage }: Props) {
  const [sectorsOpen, setSectorsOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [sellRulesOpen, setSellRulesOpen] = useState(false)
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch })
  const setStrat = (patch: Partial<Strategy>) => setStrategy({ ...strategy, ...patch })
  const toggleSector = (s: string) => set({ sectors: filters.sectors.includes(s) ? filters.sectors.filter(x => x !== s) : [...filters.sectors, s] })

  return (
    <div className="lg:sticky" style={{ top: '58px', display: 'grid', gap: '12px', minWidth: 0 }}>
      <Card pad={14}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <Label>Signal date</Label>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${settings.datePresets.length}, 1fr)`, gap: '4px' }}>
              {settings.datePresets.map(p => (
                <Chip key={p.label} active={datePreset === p.days} onClick={() => setDatePreset(p.days)}>{p.label}</Chip>
              ))}
            </div>
            {settings.yearFilter && years.length > 0 && (
              <select
                value={filters.year ?? ''}
                onChange={e => set({ year: e.target.value ? Number(e.target.value) : null })}
                style={{ marginTop: '6px', width: '100%', padding: '7px 8px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', color: 'var(--text)' }}
              >
                <option value="">Any year</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
          </div>

          <div>
            <Label right={`$${base}`}>Base per signal</Label>
            <input type="range" min={50} max={2000} step={50} value={base} onChange={e => setBase(Number(e.target.value))} />
          </div>

          <RangeRow label="Multiplier" range={filters.mult} full={RANGES.mult} step={0.5} onChange={r => set({ mult: r })} show={v => `${v.toFixed(1)}×`} />
          <RangeRow label="DCA score" range={filters.dca} full={RANGES.dca} onChange={r => set({ dca: r })} show={v => `${v}`} note={NA_NOTE} />
          <RangeRow label="Factor regime" range={filters.factor} full={RANGES.factor} onChange={r => set({ factor: r })} show={v => `${v}%`} note={NA_NOTE} />
          <RangeRow label="Volatility timing" range={filters.vol} full={RANGES.vol} onChange={r => set({ vol: r })} show={v => `${v}%`} note="Applies only on down days. Narrowing it keeps only actual dips; up days have no volatility timing." />
          <RangeRow label="Mean reversion" range={filters.mr} full={RANGES.mr} onChange={r => set({ mr: r })} show={v => `${v}%`} note={NA_NOTE} />
          <RangeRow label="Volatility (ATR 14)" range={filters.atr} full={RANGES.atr} onChange={r => set({ atr: r })} show={v => `${v}%`} note={NA_NOTE} />
        </div>
      </Card>

      <Card pad={0} style={{ overflow: 'hidden' }}>
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-2)' }}>More filters</span>
          <span style={{ fontSize: '10px', color: 'var(--text-2)', transform: moreOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
        </button>
        {moreOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 14px 14px' }}>
            <div>
              <Label>Search</Label>
              <input
                value={filters.search}
                onChange={e => set({ search: e.target.value })}
                placeholder="Ticker or name"
                style={{ width: '100%', padding: '7px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', color: 'var(--text)' }}
              />
            </div>

            <div>
              <Label>Return if held</Label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                {(['all', 'positive', 'negative'] as const).map(k => (
                  <Chip key={k} active={filters.returns === k} onClick={() => set({ returns: k })}>{k === 'all' ? 'All' : k === 'positive' ? 'Gains' : 'Losses'}</Chip>
                ))}
              </div>
            </div>

            {(
              <div>
                <Label>If sold on exit signal</Label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                  {(['all', 'open', 'closed'] as const).map(k => (
                    <Chip key={k} active={filters.status === k} onClick={() => set({ status: k })}>{k === 'all' ? 'All' : k === 'open' ? 'Held' : 'Sold'}</Chip>
                  ))}
                </div>
              </div>
            )}

            {settings.hasAlignment && (
              <div>
                <Label>Also bought on other timeframes</Label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                  <Chip active={filters.weeklyAligned} onClick={() => set({ weeklyAligned: !filters.weeklyAligned })} title="A weekly buy signal in the previous 28 days">Weekly</Chip>
                  <Chip active={filters.monthlyAligned} onClick={() => set({ monthlyAligned: !filters.monthlyAligned })} title="A monthly buy signal in the previous 90 days">Monthly</Chip>
                </div>
              </div>
            )}

            <div>
              <button
                onClick={() => setSectorsOpen(!sectorsOpen)}
                style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '7px 8px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer' }}
              >
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-2)' }}>
                  Sector: {filters.sectors.length === 0 ? 'All' : filters.sectors.length === 1 ? filters.sectors[0] : `${filters.sectors.length} selected`}
                </span>
                <span style={{ fontSize: '9px', color: 'var(--text-2)' }}>▼</span>
              </button>
              {sectorsOpen && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '6px' }}>
                  <Chip active={filters.sectors.length === 0} onClick={() => set({ sectors: [] })}>All</Chip>
                  {sectors.map(s => <Chip key={s} active={filters.sectors.includes(s)} onClick={() => toggleSector(s)}>{s}</Chip>)}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card pad={0} style={{ overflow: 'hidden' }}>
        <button
          onClick={() => setSellRulesOpen(!sellRulesOpen)}
          style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-2)' }}>Sell rules</span>
          <span style={{ fontSize: '10px', color: 'var(--text-2)', transform: sellRulesOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
        </button>
        {sellRulesOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 14px 14px' }}>
            <div>
              <Label right={strategy.minExit.toFixed(1) + (strategy.maxExit >= RANGES.exit[1] ? '+' : ` to ${strategy.maxExit.toFixed(1)}`)}>Exit score</Label>
              <input type="range" min={2} max={RANGES.exit[1]} step={0.5} value={strategy.minExit} onChange={e => setStrat({ minExit: Number(e.target.value) })} />
              <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '3px' }}>2 is the model&apos;s own exit threshold</div>
            </div>

            <div>
              <Label>Sell price</Label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                <Chip active={!strategy.nextOpen} onClick={() => setStrat({ nextOpen: false })}>Close</Chip>
                <Chip active={strategy.nextOpen} onClick={() => setStrat({ nextOpen: true })}>Next open</Chip>
              </div>
            </div>

            {settings.hasAtrStops && (
              <div>
                <Label right={strategy.atrIdx === null ? 'off' : `${ATR_MULTIPLIERS[strategy.atrIdx]}× ATR`}>Stop loss</Label>
                <input
                  type="range" min={0} max={ATR_MULTIPLIERS.length} step={1}
                  value={strategy.atrIdx === null ? 0 : strategy.atrIdx + 1}
                  onChange={e => { const v = Number(e.target.value); setStrat({ atrIdx: v === 0 ? null : v - 1 }) }}
                />
                <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '3px' }}>Below the highest close since the signal. First trigger wins.</div>
              </div>
            )}

            <div>
              <Label right={strategy.sellIfNegativeDays === null ? 'off' : `${strategy.sellIfNegativeDays} d`}>Sell if negative after</Label>
              <input
                type="range" min={0} max={365} step={1}
                value={strategy.sellIfNegativeDays === null ? 0 : strategy.sellIfNegativeDays}
                onChange={e => { const v = Number(e.target.value); setStrat({ sellIfNegativeDays: v === 0 ? null : v }) }}
              />
              <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '3px' }}>Exit underwater positions after N days. First trigger wins.</div>
            </div>

            <div>
              <Label right={strategy.sellIfDownPct === null ? 'off' : `${strategy.sellIfDownPct}%`}>Sell if down</Label>
              <input
                type="range" min={0} max={50} step={1}
                value={strategy.sellIfDownPct === null ? 0 : strategy.sellIfDownPct}
                onChange={e => { const v = Number(e.target.value); setStrat({ sellIfDownPct: v === 0 ? null : v }) }}
              />
              <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '3px' }}>Exit if down X% from entry. First trigger wins.</div>
            </div>

            <div>
              <Label right={`$${strategy.fee}`}>Fee per sale</Label>
              <input type="range" min={0} max={20} step={1} value={strategy.fee} onChange={e => setStrat({ fee: Number(e.target.value) })} />
            </div>
          </div>
        )}
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          onClick={onReset}
          style={{ padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer' }}
        >
          Reset filters
        </button>

        {userTier >= 2 && onSave ? (
          <button
            onClick={onSave}
            disabled={isSaving}
            style={{
              padding: '7px 10px',
              background: 'var(--teal)',
              border: '1px solid var(--teal)',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#000',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.7 : 1,
              transition: 'all 0.15s',
            }}
          >
            {isSaving ? 'Saving...' : 'Save filters'}
          </button>
        ) : onUpgrade && userTier < 2 ? (
          <button
            onClick={onUpgrade}
            style={{
              padding: '7px 10px',
              background: 'var(--teal)',
              border: '1px solid var(--teal)',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#000',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Upgrade to save
          </button>
        ) : null}

        {saveMessage && (
          <div style={{
            padding: '6px 8px',
            background: 'rgba(0, 196, 167, 0.12)',
            border: '1px solid var(--teal)',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--teal)',
            textAlign: 'center',
          }}>
            {saveMessage}
          </div>
        )}
      </div>
    </div>
  )
}

