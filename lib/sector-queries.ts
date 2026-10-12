// Sector page data. Everything comes from the nightly tables: assets, latest_prices, current_signal, signal_feed,
// backtest_summary and daily_prices. Nothing is recomputed per visit, and a missing value stays missing: it is
// never shown as a zero. Results are cached for a day and refreshed when the nightly job calls /api/revalidate.

import { unstable_cache } from 'next/cache'
import { fetchAllPages, getSupabaseClient } from '@/lib/supabase'
import { slugToSector } from '@/lib/sectors'

const CACHE_REVALIDATE = 24 * 60 * 60
const CACHE_TAG = 'sectors'
const CHUNK = 150 // tickers per .in() query, so each answer stays well under the 1000 row cap

function getSignalStrength(mult: number): string {
  if (mult >= 3.0) return 'strong'
  if (mult >= 1.5) return 'medium'
  if (mult > 1.0) return 'weak'
  return 'neutral'
}

export interface SectorStats {
  totalAssets: number
  avgRsi: number | null
  assetsInBuyZone: number // weekly reading at 4x or more today
  assetsMildSignal: number // weekly reading above 1x but below 4x
  sectorReturn1M: number | null
}

export interface TopPerformer {
  ticker: string
  name: string
  dcaReturnPct: number
  signalMult: number | null // most recent weekly buy signal, null if none in the last 26 weeks
  signalDate: string | null
  signalStrength: string
  dcaSuitabilityScore: number | null
}

export interface OversoldAsset {
  ticker: string
  name: string
  signalMult: number
  signalDate: string
  currentReturn: number | null // return since the fill price, null until that price exists
  signalStrength: string
  signalReasoning: string
  dcaSuitabilityScore: number | null
}

export interface RecentBuyZoneEntry {
  ticker: string
  name: string
  signalDate: string
  signalMult: number
  currentReturn: number | null // null until the entry price exists, the day after the signal
}

export interface SectorAsset {
  ticker: string
  name: string
  currentPrice: number | null
  signalMult: number | null // most recent weekly buy signal, null if none in the last 26 weeks
  signalDate: string | null
  signalReturn: number | null // return since the fill price of that signal
  signalStrength: string
  dcaReturn: number | null
  dcaSuitabilityScore: number | null
}

interface Member {
  ticker: string
  name: string
}

async function members(sectorName: string): Promise<Member[]> {
  const rows = await fetchAllPages<any>((from, to) =>
    getSupabaseClient().from('assets').select('ticker, name').eq('sector', sectorName).eq('is_active', true).order('ticker').range(from, to))
  return rows as Member[]
}

/** Run a query once per chunk of tickers, in parallel, and join the answers. Throws on any error. */
async function perChunk<T>(tickers: string[], run: (chunk: string[]) => PromiseLike<{ data: any; error: any }>): Promise<T[]> {
  const chunks: string[][] = []
  for (let i = 0; i < tickers.length; i += CHUNK) chunks.push(tickers.slice(i, i + CHUNK))
  const parts = await Promise.all(chunks.map(async c => {
    const { data, error } = await run(c)
    if (error) throw new Error(error.message)
    return (data ?? []) as T[]
  }))
  return parts.flat()
}

const round2 = (v: number) => Math.round(v * 100) / 100

/** The sector tables only list buy signals at or above this multiplier. */
const MIN_TABLE_MULT = 4

const SIGNAL_LOOKBACK_DAYS = 182

async function latestPriceDate(): Promise<string | null> {
  const { data, error } = await getSupabaseClient().from('latest_prices').select('price_date').eq('ticker', 'SPY').limit(1)
  if (error) throw new Error(error.message)
  return (data as any)?.[0]?.price_date ?? null
}

/**
 * Each asset's most recent weekly buy signal of any size, with its date. A signal below 1x is still a buy, just a
 * smaller one than the standard amount, and a week the model skips is not stored at all. So an asset with no entry
 * here has had no buy in the last 26 weeks.
 */
async function latestWeeklySignals(sectorName: string): Promise<Map<string, { date: string; mult: number; ret: number | null }>> {
  const asOf = await latestPriceDate()
  const out = new Map<string, { date: string; mult: number; ret: number | null }>()
  if (!asOf) return out
  const rows = await fetchAllPages<any>((a, b) =>
    getSupabaseClient().from('signal_feed').select('ticker, signal_date, mult, performance_pct')
      .eq('sector', sectorName).eq('freq', 'weekly').gte('signal_date', shiftDate(asOf, -SIGNAL_LOOKBACK_DAYS))
      .order('signal_date', { ascending: false }).order('ticker').range(a, b))
  for (const r of rows) if (!out.has(r.ticker)) out.set(r.ticker, { date: r.signal_date, mult: Number(r.mult), ret: r.performance_pct === null || r.performance_pct === undefined ? null : Number(r.performance_pct) })
  return out
}

/** Today's weekly reading for each ticker: the multiplier the engine gives on the latest close, and its inputs. */
async function weeklyReadings(tickers: string[]) {
  const rows = await perChunk<any>(tickers, c =>
    getSupabaseClient().from('current_signal').select('ticker, mult, components').eq('freq', 'weekly').in('ticker', c))
  return new Map<string, { mult: number; components: any }>(rows.map(r => [r.ticker, { mult: Number(r.mult), components: r.components ?? {} }]))
}

async function summaries(tickers: string[], columns: string) {
  const rows = await perChunk<any>(tickers, c =>
    getSupabaseClient().from('backtest_summary').select(`ticker, dca_suitability_score, ${columns}`).in('ticker', c))
  return new Map<string, any>(rows.map(r => [r.ticker, r]))
}

const num = (v: any): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function shiftDate(date: string, days: number): string {
  return new Date(new Date(date + 'T12:00:00Z').getTime() + days * 86400000).toISOString().slice(0, 10)
}

// ─── Stats ──────────────────────────────────────────────────────────────────────────────────

async function getSectorStatsUncached(sector: string): Promise<SectorStats> {
  const sectorName = slugToSector(sector)
  const mem = await members(sectorName)
  const tickers = mem.map(m => m.ticker)
  if (tickers.length === 0) return { totalAssets: 0, avgRsi: null, assetsInBuyZone: 0, assetsMildSignal: 0, sectorReturn1M: null }

  const [readings, latest] = await Promise.all([
    weeklyReadings(tickers),
    perChunk<any>(tickers, c => getSupabaseClient().from('latest_prices').select('ticker, price_date, close').in('ticker', c)),
  ])

  // In the buy zone: the model would buy at least the table minimum today. Mild: more than standard, but less than that.
  const inZone = Array.from(readings.values()).filter(r => r.mult >= MIN_TABLE_MULT).length
  const mild = Array.from(readings.values()).filter(r => r.mult > 1.0 && r.mult < MIN_TABLE_MULT).length
  const rsis = Array.from(readings.values()).map(r => num(r.components?.rsi)).filter((x): x is number => x !== null)

  // Equal weighted return of the sector's assets over the last month of prices
  let sectorReturn1M: number | null = null
  const newest = latest.reduce<string | null>((m, r) => (!m || r.price_date > m ? r.price_date : m), null)
  if (newest) {
    const target = new Date(newest + 'T12:00:00Z')
    target.setUTCMonth(target.getUTCMonth() - 1)
    const to = target.toISOString().slice(0, 10)
    const from = shiftDate(to, -6) // reaches back over a weekend or holiday
    const past = await perChunk<any>(tickers, c =>
      getSupabaseClient().from('daily_prices').select('ticker, date, close').in('ticker', c).gte('date', from).lte('date', to).order('date', { ascending: false }))
    const pastClose = new Map<string, number>()
    for (const p of past) if (!pastClose.has(p.ticker) && p.close > 0) pastClose.set(p.ticker, Number(p.close))
    const returns: number[] = []
    for (const l of latest) {
      const before = pastClose.get(l.ticker)
      if (before && l.close > 0) returns.push((Number(l.close) / before - 1) * 100)
    }
    if (returns.length > 0) sectorReturn1M = round2(returns.reduce((a, b) => a + b, 0) / returns.length)
  }

  return {
    totalAssets: tickers.length,
    avgRsi: rsis.length ? Math.round(rsis.reduce((a, b) => a + b, 0) / rsis.length) : null,
    assetsInBuyZone: inZone,
    assetsMildSignal: mild,
    sectorReturn1M,
  }
}

// ─── Rankings ───────────────────────────────────────────────────────────────────────────────

async function getTopPerformersUncached(sector: string, period: '1M' | '3M'): Promise<TopPerformer[]> {
  const column = period === '1M' ? 'enh_return_1m' : 'enh_return_3m'
  const mem = await members(slugToSector(sector))
  if (mem.length === 0) return []
  const tickers = mem.map(m => m.ticker)
  const sectorName = slugToSector(sector)
  const [sums, latest] = await Promise.all([summaries(tickers, column), latestWeeklySignals(sectorName)])

  const out: TopPerformer[] = []
  for (const m of mem) {
    const ret = num(sums.get(m.ticker)?.[column])
    if (ret === null) continue // no result for this window, so it is left out, never shown as zero
    const sig = latest.get(m.ticker)
    if (!sig || sig.mult < MIN_TABLE_MULT) continue
    out.push({
      ticker: m.ticker,
      name: m.name,
      dcaReturnPct: round2(ret),
      signalMult: sig ? round2(sig.mult) : null,
      signalDate: sig ? sig.date : null,
      signalStrength: sig ? getSignalStrength(sig.mult) : 'neutral',
      dcaSuitabilityScore: num(sums.get(m.ticker)?.dca_suitability_score),
    })
  }
  return out.sort((a, b) => b.dcaReturnPct - a.dcaReturnPct).slice(0, 10)
}

/** Assets that received a weekly buy signal of 4x or more in the last 7 days. */
async function getBuyOpportunitiesUncached(sector: string): Promise<OversoldAsset[]> {
  const sectorName = slugToSector(sector)
  const mem = await members(sectorName)
  if (mem.length === 0) return []
  const names = new Map(mem.map(m => [m.ticker, m.name]))

  const { data: latestRow, error: lErr } = await getSupabaseClient().from('latest_prices').select('price_date').eq('ticker', 'SPY').limit(1)
  if (lErr) throw new Error(lErr.message)
  const asOf: string | undefined = (latestRow as any)?.[0]?.price_date
  if (!asOf) return []

  const rows = await fetchAllPages<any>((from, to) =>
    getSupabaseClient().from('signal_feed').select('ticker, signal_date, mult, performance_pct, rsi_mult, ema_mult, dd_bonus, vix_bonus')
      .eq('sector', sectorName).eq('freq', 'weekly').gte('mult', MIN_TABLE_MULT).gte('signal_date', shiftDate(asOf, -7))
      .order('mult', { ascending: false }).order('ticker').range(from, to))

  const latestByTicker = new Map<string, any>()
  for (const r of rows) {
    const cur = latestByTicker.get(r.ticker)
    if (!cur || r.signal_date > cur.signal_date) latestByTicker.set(r.ticker, r)
  }
  const sums = await summaries(Array.from(latestByTicker.keys()), 'ticker')

  const out: OversoldAsset[] = []
  for (const r of Array.from(latestByTicker.values())) {
    const parts: string[] = []
    if (Number(r.rsi_mult) > 1.0) parts.push('RSI oversold')
    if (Number(r.dd_bonus) > 1.0) parts.push('drawdown bonus')
    if (Number(r.vix_bonus) > 1.0) parts.push('VIX elevated')
    if (Number(r.ema_mult) > 1.0) parts.push('below trend average')
    const mult = Number(r.mult)
    out.push({
      ticker: r.ticker,
      name: names.get(r.ticker) ?? r.ticker,
      signalMult: round2(mult),
      signalDate: r.signal_date,
      currentReturn: r.performance_pct === null || r.performance_pct === undefined ? null : Number(r.performance_pct),
      signalStrength: getSignalStrength(mult),
      signalReasoning: parts.length ? parts.join(' + ') : 'enhanced signal',
      dcaSuitabilityScore: num(sums.get(r.ticker)?.dca_suitability_score),
    })
  }
  // Many assets sit at the 6x cap, so ties are ordered by DCA suitability, best first
  return out.sort((a, b) => b.signalMult - a.signalMult || (b.dcaSuitabilityScore ?? -1) - (a.dcaSuitabilityScore ?? -1))
}

async function getOversoldAssetsUncached(sector: string): Promise<OversoldAsset[]> {
  return getBuyOpportunitiesUncached(sector)
}

/** How many of the latest signal dates the signals table covers: 3 weeks for weekly, 3 months for monthly. */
const SIGNAL_PERIODS = 3

/** The latest SIGNAL_PERIODS distinct signal dates for a frequency, across all assets, newest first. */
async function latestSignalDates(frequency: 'weekly' | 'monthly'): Promise<string[]> {
  const dates: string[] = []
  const PAGE = 1000
  for (let offset = 0; offset < 20 * PAGE; offset += PAGE) {
    const { data, error } = await getSupabaseClient().from('signal_feed').select('signal_date').eq('freq', frequency)
      .order('signal_date', { ascending: false }).range(offset, offset + PAGE - 1)
    if (error) throw new Error(error.message)
    for (const r of (data as any[]) ?? []) {
      if (!dates.includes(r.signal_date)) dates.push(r.signal_date)
      if (dates.length > SIGNAL_PERIODS) return dates.slice(0, SIGNAL_PERIODS)
    }
    if (!data || data.length < PAGE) break
  }
  return dates.slice(0, SIGNAL_PERIODS)
}

/** Every buy signal of at least 1x in the sector on the latest signal dates for the frequency, one row per signal, with the return since its fill price. */
export async function getRecentBuyZoneEntriesUncached(sector: string, frequency: 'weekly' | 'monthly' = 'weekly'): Promise<RecentBuyZoneEntry[]> {
  const sectorName = slugToSector(sector)
  const mem = await members(sectorName)
  if (mem.length === 0) return []
  const names = new Map(mem.map(m => [m.ticker, m.name]))

  const dates = await latestSignalDates(frequency)
  if (dates.length === 0) return []

  const rows = await fetchAllPages<any>((a, b) =>
    getSupabaseClient().from('signal_feed').select('ticker, signal_date, mult, performance_pct')
      .eq('sector', sectorName).eq('freq', frequency).gte('mult', 1.0).in('signal_date', dates)
      .order('signal_date', { ascending: false }).order('ticker').range(a, b))

  return rows.map(r => ({
    ticker: r.ticker as string,
    name: names.get(r.ticker) ?? (r.ticker as string),
    signalDate: r.signal_date as string,
    signalMult: round2(Number(r.mult)),
    currentReturn: r.performance_pct === null || r.performance_pct === undefined ? null : Number(r.performance_pct),
  }))
}

// ─── All assets ─────────────────────────────────────────────────────────────────────────────

async function getSectorAssetsUncached(sector: string): Promise<SectorAsset[]> {
  const mem = await members(slugToSector(sector))
  if (mem.length === 0) return []
  const tickers = mem.map(m => m.ticker)
  const [sums, latest, prices] = await Promise.all([
    summaries(tickers, 'enh_return_1y'),
    latestWeeklySignals(slugToSector(sector)),
    perChunk<any>(tickers, c => getSupabaseClient().from('latest_prices').select('ticker, close').in('ticker', c)),
  ])
  const priceBy = new Map<string, number>(prices.map(p => [p.ticker, Number(p.close)]))

  const out: SectorAsset[] = mem.filter(m => latest.has(m.ticker)).map(m => {
    const sig = latest.get(m.ticker)
    const ret = num(sums.get(m.ticker)?.enh_return_1y)
    const price = priceBy.get(m.ticker)
    return {
      ticker: m.ticker,
      name: m.name,
      currentPrice: price === undefined ? null : round2(price),
      signalMult: sig ? round2(sig.mult) : null,
      signalDate: sig ? sig.date : null,
      signalReturn: sig ? sig.ret : null,
      signalStrength: sig ? getSignalStrength(sig.mult) : 'neutral',
      dcaReturn: ret === null ? null : round2(ret),
      dcaSuitabilityScore: num(sums.get(m.ticker)?.dca_suitability_score),
    }
  })
  // Only assets with a recent weekly buy signal are listed, best current return since the signal first
  return out.sort((a, b) => (b.signalReturn ?? -1e9) - (a.signalReturn ?? -1e9))
}

// ─── Cached exports ─────────────────────────────────────────────────────────────────────────

// Bump when the shape of any cached result changes, so results saved in the old shape are never served
const CACHE_VERSION = 'v6'

const cached = <A extends unknown[], R>(fn: (...a: A) => Promise<R>, key: string) =>
  unstable_cache(fn, [CACHE_VERSION, key], { revalidate: CACHE_REVALIDATE, tags: [CACHE_TAG] })

export const getSectorStats = cached(getSectorStatsUncached, 'sector-stats')
export const getTopPerformers = cached(getTopPerformersUncached, 'top-performers')
export const getOversoldAssets = cached(getOversoldAssetsUncached, 'buy-opportunities')
export const getRecentBuyZoneEntries = cached(getRecentBuyZoneEntriesUncached, 'recent-signals')
export const getSectorAssets = cached(getSectorAssetsUncached, 'sector-assets')
