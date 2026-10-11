// Server side: builds the compact payload for a signal page from signal_feed.
// Reads one date slice at a time, in parallel, with a narrow column list. A wide select is several
// times slower because the view derives stop-loss returns per row, so those are only requested for
// the daily page.

import { getSupabaseClient } from '../supabase'
import { isoWeekKey } from '../engine/evaluate'
import { FREQ_SETTINGS } from './config'
import type { FeedPayload, Freq, SigRow, TickerInfo } from './types'

const PAGE = 1000
const PARALLEL = 8

const BASE_COLS =
  'ticker,signal_date,mult,performance_pct,exit_date,exit_return_pct,exit_next_open_return_pct,exit_score,' +
  'factor_regime,vol_timing,mean_reversion,atr_pct'
const DAILY_COLS = BASE_COLS + ',weekly_align_days,monthly_align_days,atr_breach_dates,atr_breach_returns'

const r2 = (v: any): number | null => (v === null || v === undefined ? null : Math.round(Number(v) * 100) / 100)
const r4 = (v: any): number | null => (v === null || v === undefined ? null : Math.round(Number(v) * 10000) / 10000)

async function readAll<T>(label: string, build: (from: number, to: number) => PromiseLike<{ data: any; error: any }>): Promise<T[]> {
  const out: T[] = []
  for (let page = 0; ; page++) {
    const { data, error } = await build(page * PAGE, page * PAGE + PAGE - 1)
    if (error) throw new Error(`${label}: ${error.message}`)
    if (!data?.length) break
    for (const row of data) out.push(row)
    if (data.length < PAGE) break
  }
  return out
}

/** Date ranges that each hold one period of signals: a day, an ISO week or a month. */
function buildSlices(dates: string[], freq: Freq): [string, string][] {
  const groups = new Map<string, string[]>()
  for (const d of dates) {
    const k = freq === 'daily' ? d : freq === 'weekly' ? isoWeekKey(d) : d.slice(0, 7)
    const g = groups.get(k)
    if (g) g.push(d)
    else groups.set(k, [d])
  }
  return Array.from(groups.values()).map(g => [g[0], g[g.length - 1]] as [string, string])
}

function shiftDays(date: string, days: number): string {
  return new Date(new Date(date + 'T12:00:00Z').getTime() + days * 86400000).toISOString().slice(0, 10)
}

export async function getFeed(freq: Freq): Promise<FeedPayload> {
  const db = getSupabaseClient()
  const cfg = FREQ_SETTINGS[freq]

  // Freshness and the latest day
  const { data: spyLatest, error: spyErr } = await db.from('latest_prices').select('price_date').eq('ticker', 'SPY').limit(1)
  if (spyErr) throw new Error(`latest_prices: ${spyErr.message}`)
  const asOf: string | null = (spyLatest as any)?.[0]?.price_date ?? null
  if (!asOf) throw new Error('No price data found. The nightly job has not run yet.')
  const windowFrom = shiftDays(asOf, -cfg.windowDays)

  // Read by date slice (one day, week or month), never by deep offset. An offset over this view has to
  // join and sort everything before it and times out, whereas one period is a small indexed range.
  const spyAll = await readAll<any>('spy', (f, t) => db.from('daily_prices').select('date,close').eq('ticker', 'SPY').gte('date', shiftDays(windowFrom, -7)).order('date').range(f, t))
  const slices = buildSlices(spyAll.map(s => s.date as string).filter(d => d >= windowFrom), freq)

  const cols = freq === 'daily' ? DAILY_COLS : BASE_COLS
  const raw: any[] = []
  let truncated = false
  for (let start = 0; start < slices.length; start += PARALLEL) {
    const batch = await Promise.all(
      slices.slice(start, start + PARALLEL).map(async ([from, to]) => {
        const out: any[] = []
        for (let page = 0; ; page++) {
          const { data, error } = await db.from('signal_feed').select(cols)
            .eq('freq', freq).gte('signal_date', from).lte('signal_date', to).gte('mult', cfg.minMult)
            .order('signal_date', { ascending: false }).order('ticker')
            .range(page * PAGE, page * PAGE + PAGE - 1)
          if (error) throw new Error(`signal_feed ${from}..${to}: ${error.message}`)
          for (const row of data ?? []) out.push(row)
          if (!data || data.length < PAGE) break
        }
        return out
      })
    )
    for (const b of batch) for (const row of b) { if (raw.length < cfg.rowCap) raw.push(row); else truncated = true }
  }
  raw.sort((x, y) => (x.signal_date < y.signal_date ? 1 : x.signal_date > y.signal_date ? -1 : x.ticker < y.ticker ? -1 : 1))

  // Per ticker facts
  const [assets, summaries, status] = await Promise.all([
    readAll<any>('assets', (f, t) => db.from('assets').select('ticker,name,sector').eq('is_active', true).order('ticker').range(f, t)),
    readAll<any>('backtest_summary', (f, t) => db.from('backtest_summary').select('ticker,dca_suitability_score,alpha_5y,monthly_alpha_5y').order('ticker').range(f, t)),
    db.from('pipeline_status').select('step,run_date,status,finished_at'),
  ])
  const assetByTicker = new Map<string, any>(assets.map(a => [a.ticker, a]))
  const sumByTicker = new Map<string, any>(summaries.map(s => [s.ticker, s]))

  const tickers: TickerInfo[] = []
  const idx = new Map<string, number>()
  const rows: SigRow[] = []
  for (const r of raw) {
    let i = idx.get(r.ticker)
    if (i === undefined) {
      const a = assetByTicker.get(r.ticker)
      const s = sumByTicker.get(r.ticker)
      i = tickers.length
      idx.set(r.ticker, i)
      tickers.push({
        ticker: r.ticker,
        name: a?.name ?? r.ticker,
        sector: a?.sector ?? 'Unknown',
        dca: s?.dca_suitability_score ?? null,
        alpha: freq === 'monthly' ? (s?.monthly_alpha_5y ?? null) : (s?.alpha_5y ?? null),
      })
    }
    rows.push({
      i,
      d: r.signal_date,
      m: r2(r.mult) as number,
      p: r2(r.performance_pct),
      xd: r.exit_date ?? null,
      xr: r2(r.exit_return_pct),
      xn: r2(r.exit_next_open_return_pct),
      xs: r2(r.exit_score),
      f: r4(r.factor_regime),
      v: r4(r.vol_timing),
      r: r4(r.mean_reversion),
      a: r2(r.atr_pct),
      wa: r.weekly_align_days ?? null,
      ma: r.monthly_align_days ?? null,
      sd: r.atr_breach_dates ?? null,
      sr: r.atr_breach_returns ? (r.atr_breach_returns as any[]).map(x => r2(x)) : null,
    })
  }

  const step = (name: string) => ((status.data as any[]) ?? []).find(s => s.step === name)
  return {
    freq,
    tickers,
    rows,
    asOf,
    pricesRunAt: step('prices')?.finished_at ?? null,
    signalsRunAt: step('signals')?.finished_at ?? step('backfill')?.finished_at ?? null,
    signalsStatus: step('signals')?.status ?? step('backfill')?.status ?? null,
    spyDates: spyAll.map(s => s.date as string),
    spyCloses: spyAll.map(s => Number(s.close)),
    windowFrom,
    minMult: cfg.minMult,
    truncated,
  }
}
