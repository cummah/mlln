/**
 * compute-daily-signal-enrichment.ts
 *
 * Enriches daily signals with regime factor, volatility timing, and mean reversion
 * scores computed fresh from daily price bars. Also includes performance, technical
 * metrics, and alignment days.
 *
 * Incremental mode (default): only updates signals from the last 3-5 days to keep
 * recent performance current while avoiding full recomputation.
 *
 * Usage:
 *   npm run compute:daily-enrichment              # Incremental: last 3-5 days only
 *   npm run compute:daily-enrichment -- --full    # Full: all signals (use after backfill)
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import {
  type PriceBar,
  computeEWMAVol,
  getVolBonus,
  computeMeanReversion,
  getMeanReversionBonus,
  getPCAModifier,
} from '../lib/macroFactors'

const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BATCH_SIZE = 10
const FULL_PRICE_LOOKBACK_DAYS = 400
const INCREMENTAL_WINDOW_DAYS = 5 // covers weekends
const SIGNAL_OUTPUT_WINDOW_DAYS = 100
const WEEKLY_ALIGNMENT_WINDOW_MS = 28 * 24 * 60 * 60 * 1000
const MONTHLY_ALIGNMENT_WINDOW_MS = 90 * 24 * 60 * 60 * 1000
const ATR_PERIOD = 14

const fullMode = process.argv.includes('--full')

function toEpochNoon(dateStr: string): number {
  return new Date(dateStr + 'T12:00:00').getTime()
}

async function fetchAllPrices(tickers: string[], sinceDate: string) {
  const pageSize = 1000
  let page = 0
  const rows: any[] = []
  while (true) {
    const start = page * pageSize
    const { data, error } = await supabase
      .from('daily_prices')
      .select('ticker, date, close, high, low')
      .in('ticker', tickers)
      .gte('date', sinceDate)
      .order('date', { ascending: true })
      .range(start, start + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < pageSize) break
    page++
  }
  return rows
}

function computeTechnicalMetrics(prices: { close: number; high: number; low: number }[], idx: number) {
  const windowStart = Math.max(0, idx - (ATR_PERIOD - 1))
  const window = prices.slice(windowStart, idx + 1)

  let volatility: number | null = null
  let trendStrength: number | null = null
  if (window.length >= 2) {
    let atrSum = 0
    for (let i = 1; i < window.length; i++) {
      const tr = Math.max(
        window[i].high - window[i].low,
        Math.abs(window[i].high - window[i - 1].close),
        Math.abs(window[i].low - window[i - 1].close)
      )
      atrSum += tr
    }
    const closes = window.map(p => p.close)
    const lastClose = closes[closes.length - 1]
    volatility = lastClose > 0 ? (atrSum / (window.length - 1)) / lastClose * 100 : null

    const trend = closes[closes.length - 1] - closes[0]
    const range = Math.max(...closes) - Math.min(...closes)
    trendStrength = range > 0 ? Math.abs(trend) / range : 0
  }

  let fiveDayMomentum: number | null = null
  const fiveDaysAgoIdx = Math.max(0, idx - 5)
  if (fiveDaysAgoIdx < idx) {
    const base = prices[fiveDaysAgoIdx].close
    fiveDayMomentum = base > 0 ? ((prices[idx].close - base) / base) * 100 : null
  }

  return {
    volatility: volatility !== null ? Math.round(volatility * 10) / 10 : null,
    trendStrength: trendStrength !== null ? Math.round(trendStrength * 1000) / 1000 : null,
    fiveDayMomentum: fiveDayMomentum !== null ? Math.round(fiveDayMomentum * 10) / 10 : null,
  }
}

async function fetchFactorModel() {
  const byDate = new Map<string, number[]>()
  let page = 0
  while (true) {
    const { data } = await supabase
      .from('factor_model_history')
      .select('date, factor_index, factor_momentum_zscore')
      .order('date, factor_index', { ascending: true })
      .range(page * 1000, page * 1000 + 999)
    if (!data || data.length === 0) break
    ;(data as any[]).forEach((row: any) => {
      const arr = byDate.get(row.date) || []
      if (!arr[row.factor_index]) arr[row.factor_index] = 0
      arr[row.factor_index] = row.factor_momentum_zscore || 0
      byDate.set(row.date, arr)
    })
    if (data.length < 1000) break
    page++
  }
  return byDate
}

async function fetchAssetLoadings() {
  const byTicker = new Map<string, number[]>()
  let page = 0
  while (true) {
    const { data } = await supabase
      .from('factor_model_loadings')
      .select('ticker, loadings')
      .order('ticker')
      .range(page * 1000, page * 1000 + 999)
    if (!data || data.length === 0) break
    ;(data as any[]).forEach((row: any) => {
      byTicker.set(row.ticker.toUpperCase(), row.loadings || [])
    })
    if (data.length < 1000) break
    page++
  }
  return byTicker
}

async function fetchAtrBreaches(tickers: string[]) {
  const { data } = await supabase
    .from('daily_signal_atr_breaches')
    .select('ticker, signal_date, atr_multiplier, breach_date, breach_return')
    .in('ticker', tickers)
  const byTickerAndDate = new Map<string, any[]>()
  ;(data as any[] || []).forEach((row: any) => {
    const key = `${row.ticker}|${row.signal_date}`
    if (!byTickerAndDate.has(key)) byTickerAndDate.set(key, [])
    byTickerAndDate.get(key)!.push(row)
  })
  return byTickerAndDate
}

async function computeBatch(
  tickers: string[],
  factorsByDate: Map<string, number[]>,
  assetLoadings: Map<string, number[]>
) {
  const lookbackDays = fullMode ? FULL_PRICE_LOOKBACK_DAYS : INCREMENTAL_WINDOW_DAYS
  const sinceDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [{ data: signalRows }, priceRows, { data: backtestRows }, atrByTickerAndDate] = await Promise.all([
    supabase.from('daily_signals').select('ticker, signals_1y').in('ticker', tickers),
    fetchAllPrices(tickers, sinceDate),
    supabase.from('backtest_signals').select('ticker, signals_5y_weekly, signals_5y_monthly').in('ticker', tickers),
    fetchAtrBreaches(tickers),
  ])

  const pricesByTicker = new Map<string, { date: string; close: number; high: number; low: number }[]>()
  for (const row of (priceRows as any[]) || []) {
    if (row.close == null || row.high == null || row.low == null) continue
    const list = pricesByTicker.get(row.ticker) ?? []
    list.push({ date: row.date, close: row.close, high: row.high, low: row.low })
    pricesByTicker.set(row.ticker, list)
  }

  const backtestByTicker = new Map<string, any>()
  for (const row of (backtestRows as any[]) || []) {
    backtestByTicker.set(row.ticker.toUpperCase(), row)
  }

  const getAtrBreachesForSignal = (ticker: string, signalDate: string) => {
    const breaches = atrByTickerAndDate.get(`${ticker}|${signalDate}`) || []
    const ATR_MULTIPLIERS = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0]
    const breachDates: (string | null)[] = new Array(7).fill(null)
    const breachReturns: (number | null)[] = new Array(7).fill(null)
    for (const breach of breaches) {
      const idx = ATR_MULTIPLIERS.indexOf(Number(breach.atr_multiplier))
      if (idx >= 0) {
        breachDates[idx] = breach.breach_date
        breachReturns[idx] = breach.breach_return
      }
    }
    return { atrStopBreachDates: breachDates, atrStopBreachReturns: breachReturns }
  }

  const upserts: any[] = []
  const outputCutoffMs = Date.now() - SIGNAL_OUTPUT_WINDOW_DAYS * 24 * 60 * 60 * 1000

  for (const row of (signalRows as any[]) || []) {
    const ticker = row.ticker
    const rawSignals = (row.signals_1y as any[]) || []
    const allPrices = pricesByTicker.get(ticker) || []

    if (allPrices.length === 0) continue

    // Filter to signals in output window (and incremental window if not full mode)
    const signals: any[] = []
    for (const sig of rawSignals) {
      if (!(sig.finalMult > 0) || !sig.date) continue
      const sigTime = new Date(sig.date).getTime()
      if (sigTime < outputCutoffMs) continue
      if (!fullMode && sigTime < Date.now() - INCREMENTAL_WINDOW_DAYS * 24 * 60 * 60 * 1000) continue

      // Find prices up to signal date for factor computation
      const pricesUpToSignal = allPrices.filter(p => p.date <= sig.date)
      if (pricesUpToSignal.length === 0) continue

      // Compute factors from historical data up to signal date
      const volMapUpToSignal = computeEWMAVol(pricesUpToSignal.map(p => ({ date: p.date, close: p.close })))
      const mrUpToSignal = computeMeanReversion(pricesUpToSignal.map(p => ({ date: p.date, close: p.close })))
      const momentumVector = factorsByDate.get(sig.date) || []

      const factorRegimeScore = getPCAModifier(assetLoadings.get(ticker.toUpperCase()), momentumVector)
      const volTimingScore = getVolBonus(volMapUpToSignal.get(sig.date))
      const meanReversionScore = getMeanReversionBonus(mrUpToSignal.zScoreByDate.get(sig.date), mrUpToSignal.halfLifeDays)

      // Performance and technical metrics
      const latestClose = allPrices[allPrices.length - 1].close
      const priceIdx = allPrices.findIndex(p => p.date === sig.date)
      const closeAtSignal = priceIdx >= 0 ? allPrices[priceIdx].close : undefined
      const performance = closeAtSignal != null && latestClose != null
        ? ((latestClose - closeAtSignal) / closeAtSignal) * 100
        : null
      const technical = priceIdx >= 0
        ? computeTechnicalMetrics(allPrices, priceIdx)
        : { volatility: null, trendStrength: null, fiveDayMomentum: null }

      // Alignment to weekly/monthly buys
      const backtestRow = backtestByTicker.get(ticker.toUpperCase())
      const weeklyBuyDates = ((backtestRow?.signals_5y_weekly as any[]) || [])
        .filter((s: any) => s.finalMult > 0 && s.date)
        .map((s: any) => toEpochNoon(s.date))
      const monthlyBuyDates = ((backtestRow?.signals_5y_monthly as any[]) || [])
        .filter((s: any) => s.finalMult > 0 && s.date)
        .map((s: any) => toEpochNoon(s.date))

      const signalTs = toEpochNoon(sig.date)
      let weeklyAlignmentDays: number | null = null
      for (const wts of weeklyBuyDates) {
        const diff = signalTs - wts
        if (diff >= 0 && diff <= WEEKLY_ALIGNMENT_WINDOW_MS) {
          const days = Math.floor(diff / (24 * 60 * 60 * 1000))
          if (weeklyAlignmentDays === null || days < weeklyAlignmentDays) weeklyAlignmentDays = days
        }
      }
      let monthlyAlignmentDays: number | null = null
      for (const mts of monthlyBuyDates) {
        const diff = signalTs - mts
        if (diff >= 0 && diff <= MONTHLY_ALIGNMENT_WINDOW_MS) {
          const days = Math.floor(diff / (24 * 60 * 60 * 1000))
          if (monthlyAlignmentDays === null || days < monthlyAlignmentDays) monthlyAlignmentDays = days
        }
      }

      const atrBreaches = getAtrBreachesForSignal(ticker, sig.date)

      signals.push({
        date: sig.date,
        finalMult: sig.finalMult,
        performance,
        exitDate: sig.exitDate ?? null,
        exitReturn: sig.exitReturn ?? null,
        exitScore: sig.exitScore ?? null,
        exitDateNextOpen: sig.exitDateNextOpen ?? null,
        exitReturnNextOpen: sig.exitReturnNextOpen ?? null,
        exitOpen: sig.exitOpen ?? true,
        atrStopBreachDates: atrBreaches.atrStopBreachDates,
        atrStopBreachReturns: atrBreaches.atrStopBreachReturns,
        weeklyAlignmentDays,
        monthlyAlignmentDays,
        volatility: technical.volatility,
        trendStrength: technical.trendStrength,
        fiveDayMomentum: technical.fiveDayMomentum,
        factorRegimeScore,
        volTimingScore,
        meanReversionScore,
      })
    }

    if (signals.length > 0) {
      const latestDate = allPrices[allPrices.length - 1].date
      upserts.push({
        ticker,
        signals,
        latest_date: latestDate,
        updated_at: new Date().toISOString(),
      })
    }
  }

  if (upserts.length > 0) {
    const { error } = await supabase.from('daily_signal_enrichment').upsert(upserts, { onConflict: 'ticker' })
    if (error) throw error
  }

  return upserts.length
}

async function main() {
  console.log(`Starting ${fullMode ? 'full' : 'incremental'} enrichment...`)

  console.log('Fetching factor model and loadings...')
  const [factorsByDate, assetLoadings] = await Promise.all([fetchFactorModel(), fetchAssetLoadings()])

  const assets: Array<{ ticker: string }> = []
  for (let page = 0; ; page++) {
    const { data } = await supabase
      .from('assets')
      .select('ticker')
      .eq('is_active', true)
      .order('ticker')
      .range(page * 1000, page * 1000 + 999)
    if (!data || data.length === 0) break
    assets.push(...data)
  }

  console.log(`Processing ${assets.length} tickers in batches of ${BATCH_SIZE}...`)
  let totalProcessed = 0
  for (let i = 0; i < assets.length; i += BATCH_SIZE) {
    const batch = assets.slice(i, i + BATCH_SIZE).map(a => a.ticker.toUpperCase())
    const start = Date.now()
    const count = await computeBatch(batch, factorsByDate, assetLoadings)
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    totalProcessed += count
    console.log(`  [${i + batch.length}/${assets.length}] processed ${count} tickers in ${elapsed}s`)
  }

  console.log(`\n✓ Enrichment complete: ${totalProcessed} tickers updated`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
