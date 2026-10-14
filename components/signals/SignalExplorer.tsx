'use client'

import Link from 'next/link'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { DEFAULT_FILTERS, DEFAULT_STRATEGY, FREQ_SETTINGS } from '@/lib/signals/config'
import { daysAgo, dateShort, timeAgo } from '@/lib/signals/format'
import { applyFilters, cohorts, computeStats, effective, makeSpy } from '@/lib/signals/model'
import type { FeedPayload, Filters, Freq, SigRow, Strategy } from '@/lib/signals/types'
import { FilterRail } from './FilterRail'
import { SignalDrawer } from './SignalDrawer'
import { SignalTable } from './SignalTable'
import { CohortChart, Results } from './Summary'
import { sliderCss } from './ui'

const TABS: { key: Freq; label: string }[] = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
]

function shift(date: string, days: number): string {
  return new Date(new Date(date + 'T12:00:00Z').getTime() - days * 86400000).toISOString().slice(0, 10)
}

export function SignalExplorer({ data }: { data: FeedPayload }) {
  const { freq } = data
  const settings = FREQ_SETTINGS[freq]

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [strategy, setStrategy] = useState<Strategy>(DEFAULT_STRATEGY)
  const [base, setBase] = useState(settings.baseAmount)
  const [datePreset, setDatePreset] = useState<number | null>(null)
  const [selected, setSelected] = useState<SigRow | null>(null)
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => setNow(Date.now()), [])

  const sectors = useMemo(() => Array.from(new Set(data.tickers.map(t => t.sector))).sort(), [data.tickers])
  const years = useMemo(() => Array.from(new Set(data.rows.map(r => Number(r.d.slice(0, 4))))).sort((a, b) => b - a), [data.rows])
  const spy = useMemo(() => makeSpy(data.spyDates, data.spyCloses), [data.spyDates, data.spyCloses])

  // Sliders move fast, so the heavy recalculation follows a deferred copy of the state
  const effFilters = useMemo<Filters>(() => ({ ...filters, dateFrom: datePreset === null || !data.asOf ? null : shift(data.asOf, datePreset) }), [filters, datePreset, data.asOf])
  const dFilters = useDeferredValue(effFilters)
  const dStrategy = useDeferredValue(strategy)
  const dBase = useDeferredValue(base)

  const rows = useMemo(() => {
    const filtered = applyFilters(data.rows, data.tickers, dFilters)
    if (dFilters.returns === 'all' && dFilters.status === 'all') return filtered
    return filtered.filter(r => {
      // Return filter is on the held return. Status filter is on whether the exit signal sold it.
      if (dFilters.returns === 'positive' && !(r.p !== null && r.p >= 0)) return false
      if (dFilters.returns === 'negative' && !(r.p !== null && r.p < 0)) return false
      if (dFilters.status !== 'all') {
        const closed = effective(r, dStrategy).closed
        if (dFilters.status === 'open' && closed) return false
        if (dFilters.status === 'closed' && !closed) return false
      }
      return true
    })
  }, [data.rows, data.tickers, dFilters, dStrategy])

  const stats = useMemo(() => computeStats(rows, dBase, dStrategy, spy), [rows, dBase, dStrategy, spy])
  const chart = useMemo(() => cohorts(rows, dBase, dStrategy, freq), [rows, dBase, dStrategy, freq])

  const reset = () => { setFilters(DEFAULT_FILTERS); setDatePreset(null); setBase(settings.baseAmount); setStrategy(DEFAULT_STRATEGY) }

  const age = data.asOf && now ? daysAgo(data.asOf, now) : null
  const staleWarning = (age !== null && age > 4) || data.signalsStatus === 'failed'

  return (
    <div className="min-h-screen bg-[var(--bg)]" style={{ padding: '14px 18px 28px', width: '100%', maxWidth: '1360px', marginLeft: 'auto', marginRight: 'auto', overflowX: 'clip' }}>
      <nav style={{ fontSize: '12px', color: 'var(--text-2)', display: 'flex', gap: '6px', marginBottom: '12px' }}>
        <Link href="/sectors" style={{ color: 'var(--text-2)', textDecoration: 'none' }} className="hover:text-[var(--text)]">Assets</Link>
        <span>›</span>
        <span style={{ color: 'var(--text)' }}>{settings.title}</span>
      </nav>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.2px' }}>{settings.title}</h1>
          <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '4px' }}>
            Prices as of the {data.asOf ? dateShort(data.asOf) : 'n/a'} close
            {' · '}signals updated {timeAgo(data.signalsRunAt, now ?? undefined)}
            {data.minMult > 0 && <> · showing signals at {data.minMult}× and above</>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '2px' }}>
          {TABS.map(t => (
            <Link key={t.key} href={`/asset/${t.key}`} style={{ padding: '6px 16px', borderRadius: '6px', fontSize: '13px', textDecoration: 'none', fontWeight: t.key === freq ? 700 : 500, background: t.key === freq ? 'var(--teal)' : 'transparent', color: t.key === freq ? '#040e18' : 'var(--text-2)' }}>
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      {staleWarning && (
        <div role="alert" style={{ background: 'rgba(226,75,74,0.12)', border: '1px solid #E24B4A', color: 'var(--text)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', marginBottom: '14px' }}>
          {data.signalsStatus === 'failed'
            ? 'The latest nightly update failed its data checks, so these figures may be out of date.'
            : `The newest price on this page is ${age} days old, so these figures may be out of date.`}
        </div>
      )}
      {data.truncated && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: 'var(--text-2)', marginBottom: '14px' }}>
          This view was capped at {settings.rowCap.toLocaleString()} signals. The oldest were left out.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[270px_minmax(0,1fr)]" style={{ gap: '14px', alignItems: 'start' }}>
        <FilterRail
          settings={settings} filters={filters} setFilters={setFilters} base={base} setBase={setBase}
          datePreset={datePreset} setDatePreset={setDatePreset} sectors={sectors} years={years} onReset={reset}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '12px', minWidth: 0 }}>
          <Results stats={stats} base={dBase} strategy={strategy} setStrategy={setStrategy} settings={settings} />
          <CohortChart data={chart} unit={settings.unit} />
          <SignalTable rows={rows} tickers={data.tickers} strategy={dStrategy} base={dBase} freq={freq} onSelect={setSelected} />
        </div>
      </div>

      {selected && (
        <SignalDrawer
          ticker={data.tickers[selected.i].ticker} name={data.tickers[selected.i].name}
          date={selected.d} freq={freq} onClose={() => setSelected(null)}
        />
      )}
      <style dangerouslySetInnerHTML={{ __html: sliderCss }} />
    </div>
  )
}
