// Demo watchlist data. One curated list shown to every visitor: for each asset, its signal in the latest weekly and monthly
// period, and its monthly signals since the list's start date. Everything comes from the nightly tables (assets,
// latest_prices, signal_feed) and is cached for a day, refreshed when the nightly job calls /api/revalidate. A missing
// value stays missing, it is never shown as a zero.

import { unstable_cache } from 'next/cache'
import { fetchAllPages, getSupabaseClient } from '@/lib/supabase'
import { isoWeekKey } from '@/lib/engine/evaluate'
import { FREQ_SETTINGS } from '@/lib/signals/config'
import { buildYtd, type Bar, type FeedEntry, type YtdData } from '@/lib/watchlist-ytd'

// The ten largest listed companies at the start of 2026, chosen by the product owner (Alphabet is GOOGL, Berkshire is
// BRK.A). The list is fixed as of that date, so it is not picked with hindsight. The start date is assumed: the list is
// shown as if it had been watched and invested in from 1 January 2026.
export const DEMO_WATCHLIST = {
  name: 'Top 10 Watchlist',
  description: 'The ten largest companies at the start of 2026, watched since then. See what the model buys this period, how much of each, and how a monthly plan has done since January against standard DCA and SPY.',
  tickers: ['NVDA', 'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSM', 'AVGO', 'META', 'TSLA', 'BRK.A'],
  startDate: '2026-01-01',
}

export type WatchFreq = 'weekly' | 'monthly'

export interface WatchSignal {
  date: string
  mult: number
  returnSince: number | null // return since the fill price, null until that price exists
  inLatestPeriod: boolean // false when the asset has no signal in the latest week or month
}

export interface WatchRow {
  ticker: string
  name: string
  sector: string
  price: number | null
  weekly: WatchSignal | null
  monthly: WatchSignal | null
  history: Record<string, number> // monthly signal multiplier by YYYY-MM since the start date, a month with no signal is absent
}

export interface DemoWatchlist {
  name: string
  description: string
  startDate: string
  rows: WatchRow[]
  months: string[] // YYYY-MM from the start month to the latest monthly signal
  latestDate: Record<WatchFreq, string | null> // newest signal date, which is the latest period
  baseAmount: Record<WatchFreq, number>
  ytd: YtdData | null // null when the prices or signals needed to work it out are missing
}

const LOOKBACK_DAYS: Record<WatchFreq, number> = { weekly: 60, monthly: 130 }

function shiftDate(date: string, days: number): string {
  return new Date(new Date(date + 'T12:00:00Z').getTime() + days * 86400000).toISOString().slice(0, 10)
}

/** The week or month a date belongs to. A month's signals can land a day apart across assets, so months compare by YYYY-MM. */
const periodKey = (date: string, freq: WatchFreq) => (freq === 'weekly' ? isoWeekKey(date) : date.slice(0, 7))

const round2 = (v: number) => Math.round(v * 100) / 100

async function latestSignalDate(freq: WatchFreq): Promise<string | null> {
  const { data, error } = await getSupabaseClient().from('signal_feed').select('signal_date').eq('freq', freq)
    .order('signal_date', { ascending: false }).limit(1)
  if (error) throw new Error(`signal_feed latest ${freq}: ${error.message}`)
  return (data as any)?.[0]?.signal_date ?? null
}

async function latestSignals(tickers: string[], freq: WatchFreq, latest: string | null): Promise<Map<string, WatchSignal>> {
  const out = new Map<string, WatchSignal>()
  if (!latest) return out
  const { data, error } = await getSupabaseClient().from('signal_feed').select('ticker, signal_date, mult, performance_pct')
    .eq('freq', freq).in('ticker', tickers).gte('signal_date', shiftDate(latest, -LOOKBACK_DAYS[freq]))
    .order('signal_date', { ascending: false }).order('ticker')
  if (error) throw new Error(`signal_feed ${freq}: ${error.message}`)
  const latestKey = periodKey(latest, freq)
  for (const r of (data as any[]) ?? []) {
    if (out.has(r.ticker)) continue // newest first, so the first row per ticker is its latest signal
    out.set(r.ticker, {
      date: r.signal_date,
      mult: round2(Number(r.mult)),
      returnSince: r.performance_pct === null || r.performance_pct === undefined ? null : Number(r.performance_pct),
      inLatestPeriod: periodKey(r.signal_date, freq) === latestKey,
    })
  }
  return out
}

/** Every monthly signal since the start date, as ticker -> YYYY-MM -> multiplier and the fill the feed holds for it. */
async function monthlyFeed(tickers: string[], start: string): Promise<Map<string, Record<string, FeedEntry>>> {
  const { data, error } = await getSupabaseClient().from('signal_feed').select('ticker, signal_date, mult, entry_date, entry_price')
    .eq('freq', 'monthly').in('ticker', tickers).gte('signal_date', start).order('signal_date')
  if (error) throw new Error(`signal_feed monthly history: ${error.message}`)
  const out = new Map<string, Record<string, FeedEntry>>()
  for (const r of (data as any[]) ?? []) {
    const h = out.get(r.ticker) ?? {}
    h[periodKey(r.signal_date, 'monthly')] = {
      mult: round2(Number(r.mult)),
      entryDate: r.entry_date ?? null,
      entryPrice: r.entry_price === null || r.entry_price === undefined ? null : Number(r.entry_price),
    }
    out.set(r.ticker, h)
  }
  return out
}

/** Daily bars since the start date for the list and SPY, as ticker -> date -> bar. */
async function dailyBars(tickers: string[], start: string): Promise<Map<string, Map<string, Bar>>> {
  const rows = await fetchAllPages<any>((a, b) =>
    getSupabaseClient().from('daily_prices').select('ticker, date, open, close').in('ticker', tickers).gte('date', start)
      .order('ticker').order('date').range(a, b))
  const out = new Map<string, Map<string, Bar>>()
  for (const r of rows) {
    const m = out.get(r.ticker) ?? new Map<string, Bar>()
    m.set(r.date, { open: r.open === null ? null : Number(r.open), close: r.close === null ? null : Number(r.close) })
    out.set(r.ticker, m)
  }
  return out
}

function monthRange(startDate: string, latest: string | null): string[] {
  if (!latest) return []
  const out: string[] = []
  const end = latest.slice(0, 7)
  for (let [y, m] = [Number(startDate.slice(0, 4)), Number(startDate.slice(5, 7))]; ; m++) {
    if (m > 12) { m = 1; y++ }
    const key = `${y}-${String(m).padStart(2, '0')}`
    if (key > end) break
    out.push(key)
  }
  return out
}

async function getDemoWatchlistUncached(): Promise<DemoWatchlist> {
  const db = getSupabaseClient()
  const { tickers, startDate } = DEMO_WATCHLIST
  const [weeklyLatest, monthlyLatest] = await Promise.all([latestSignalDate('weekly'), latestSignalDate('monthly')])
  const [assets, prices, weekly, monthly, feed, bars] = await Promise.all([
    db.from('assets').select('ticker, name, sector').eq('is_active', true).in('ticker', tickers),
    db.from('latest_prices').select('ticker, close').in('ticker', tickers),
    latestSignals(tickers, 'weekly', weeklyLatest),
    latestSignals(tickers, 'monthly', monthlyLatest),
    monthlyFeed(tickers, startDate),
    dailyBars([...tickers, 'SPY'], startDate),
  ])
  if (assets.error) throw new Error(`assets: ${assets.error.message}`)
  if (prices.error) throw new Error(`latest_prices: ${prices.error.message}`)

  const assetBy = new Map<string, any>(((assets.data as any[]) ?? []).map(a => [a.ticker, a]))
  const priceBy = new Map<string, number>(((prices.data as any[]) ?? []).map(p => [p.ticker, Number(p.close)]))

  // List order is kept, and an asset that is no longer active is left out rather than shown with made-up data
  const rows: WatchRow[] = tickers.filter(t => assetBy.has(t)).map(t => {
    const a = assetBy.get(t)
    const price = priceBy.get(t)
    return {
      ticker: t,
      name: a.name ?? t,
      sector: a.sector ?? 'Unknown',
      price: price !== undefined && price > 0 ? round2(price) : null,
      weekly: weekly.get(t) ?? null,
      monthly: monthly.get(t) ?? null,
      history: Object.fromEntries(Object.entries(feed.get(t) ?? {}).map(([m, e]) => [m, e.mult])),
    }
  })

  const months = monthRange(startDate, monthlyLatest)
  const listed = rows.map(r => r.ticker)

  return {
    name: DEMO_WATCHLIST.name,
    description: DEMO_WATCHLIST.description,
    startDate,
    rows,
    months,
    latestDate: { weekly: weeklyLatest, monthly: monthlyLatest },
    baseAmount: { weekly: FREQ_SETTINGS.weekly.baseAmount, monthly: FREQ_SETTINGS.monthly.baseAmount },
    ytd: buildYtd(listed, months, feed, bars, FREQ_SETTINGS.monthly.baseAmount),
  }
}

// Bump when the shape of the cached result changes, so results saved in the old shape are never served
export const getDemoWatchlist = unstable_cache(getDemoWatchlistUncached, ['v5', 'demo-watchlist'], {
  revalidate: 24 * 60 * 60,
  tags: ['watchlist'],
})
