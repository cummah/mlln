import { fetchOHLC, getSupabaseClient } from '../supabase'
import { getTickerSummary, type TickerSummary } from './summary'
import type { AssetData, OHLCData, Signal } from '@/types'

export interface CurrentReading {
  asOf: string
  mult: number
  isEvaluationBar: boolean
}

export interface MajorBuy {
  date: string
  mult: number
  invested: number
  performance: number | null // percent to the latest close, null until the entry price exists
  currentValue: number | null
}

export interface TickerPageData {
  asset: AssetData
  summary: TickerSummary | null
  spyReturn5y: number | null
  ohlc: OHLCData[]
  weeklySignals: Signal[]
  monthlySignals: Signal[]
  current: { weekly: CurrentReading | null; monthly: CurrentReading | null }
  major: { weekly: MajorBuy | null; monthly: MajorBuy | null }
  universeCount: number
  priceDate: string | null
}

const BASE = { weekly: 100, monthly: 433 }
const MAJOR_MULT = 5

/** Everything the asset page shows, from the nightly tables. Returns null only if the asset does not exist. */
export async function getTickerPageData(rawTicker: string): Promise<TickerPageData | null> {
  const ticker = rawTicker.toUpperCase()
  const db = getSupabaseClient()

  const { data: assetRows, error: aErr } = await db.from('assets').select('ticker, name, sector, asset_type, is_active').eq('ticker', ticker).limit(1)
  if (aErr) throw new Error(`assets: ${aErr.message}`)
  const a = (assetRows as any[])?.[0]
  if (!a) return null

  const [summary, spy, ohlc, price, signalRows, currentRows, count] = await Promise.all([
    getTickerSummary(ticker),
    ticker === 'SPY' ? Promise.resolve(null) : getTickerSummary('SPY'),
    fetchOHLC(ticker, 1825),
    db.from('latest_prices').select('price_date, close, prev_close').eq('ticker', ticker).limit(1),
    db.from('signal_feed').select('freq, signal_date, mult, entry_price, performance_pct, latest_price')
      .eq('ticker', ticker).in('freq', ['weekly', 'monthly']).order('signal_date', { ascending: true }).limit(1000),
    db.from('current_signal').select('freq, as_of, mult, components').eq('ticker', ticker).in('freq', ['weekly', 'monthly']),
    db.from('current_signal').select('*', { count: 'exact', head: true }).eq('freq', 'weekly'),
  ])
  for (const r of [price, signalRows, currentRows]) if (r.error) throw new Error(r.error.message)

  const p = (price.data as any[])?.[0]
  const last = p ? Number(p.close) : null
  const prev = p && p.prev_close != null ? Number(p.prev_close) : null

  const all = (signalRows.data as any[]) ?? []
  const toSignals = (freq: 'weekly' | 'monthly'): Signal[] =>
    all.filter(r => r.freq === freq).map(r => ({ date: r.signal_date, mult: Number(r.mult), skipped: false, buyAmount: BASE[freq] * Number(r.mult) }))
  const major = (freq: 'weekly' | 'monthly'): MajorBuy | null => {
    const rows = all.filter(r => r.freq === freq && Number(r.mult) >= MAJOR_MULT)
    const r = rows[rows.length - 1]
    if (!r) return null
    const invested = BASE[freq] * Number(r.mult)
    const perf = r.performance_pct === null || r.performance_pct === undefined ? null : Number(r.performance_pct)
    return { date: r.signal_date, mult: Number(r.mult), invested, performance: perf, currentValue: perf === null ? null : invested * (1 + perf / 100) }
  }
  const cur = (freq: 'weekly' | 'monthly'): CurrentReading | null => {
    const r = ((currentRows.data as any[]) ?? []).find(x => x.freq === freq)
    return r ? { asOf: r.as_of, mult: Number(r.mult), isEvaluationBar: !!r.components?.isEvaluationBar } : null
  }

  return {
    asset: {
      ticker: a.ticker,
      name: a.name,
      sector: a.sector ?? undefined,
      assetType: a.asset_type ?? 'stock',
      price: last ?? 0,
      change1d: last !== null && prev !== null ? last - prev : 0,
      changePercent1d: last !== null && prev !== null && prev > 0 ? (last / prev - 1) * 100 : 0,
    },
    summary,
    spyReturn5y: spy && spy.available.weekly['5y'] ? spy.stdReturn5y : null,
    ohlc,
    weeklySignals: toSignals('weekly'),
    monthlySignals: toSignals('monthly'),
    current: { weekly: cur('weekly'), monthly: cur('monthly') },
    major: { weekly: major('weekly'), monthly: major('monthly') },
    universeCount: count.count ?? 0,
    priceDate: p?.price_date ?? null,
  }
}
