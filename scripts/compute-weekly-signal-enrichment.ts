/**
 * compute-weekly-signal-enrichment.ts
 *
 * Enriches weekly signals with regime factor, volatility timing, and mean reversion
 * scores computed from weekly aggregated price bars. Also includes performance and
 * exit fields.
 *
 * Incremental mode (default): only updates signals from the last 2 weeks.
 *
 * Usage:
 *   npm run compute:weekly-enrichment              # Incremental: last 2 weeks only
 *   npm run compute:weekly-enrichment -- --full    # Full: all signals (use after backfill)
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

const BATCH_SIZE = 40
const FULL_PRICE_LOOKBACK_DAYS = 450
const INCREMENTAL_WINDOW_DAYS = 14 // ~2 weeks
const SIGNAL_LIMIT = 20

const fullMode = process.argv.includes('--full')

async function fetchAllPrices(tickers: string[], sinceDate: string) {
  const pageSize = 1000
  let page = 0
  const rows: any[] = []
  while (true) {
    const start = page * pageSize
    const { data, error } = await supabase
      .from('daily_prices')
      .select('ticker, date, close')
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

async function computeBatch(
  tickers: string[],
  factorsByDate: Map<string, number[]>,
  assetLoadings: Map<string, number[]>
) {
  const lookbackDays = fullMode ? FULL_PRICE_LOOKBACK_DAYS : INCREMENTAL_WINDOW_DAYS
  const sinceDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [{ data: backtestRows }, priceRows] = await Promise.all([
    supabase.from('backtest_signals').select('ticker, signals_5y_weekly').in('ticker', tickers),
    fetchAllPrices(tickers, sinceDate),
  ])

  const pricesByTicker = new Map<string, PriceBar[]>()
  for (const row of (priceRows as any[]) || []) {
    if (row.close == null) continue
    const list = pricesByTicker.get(row.ticker) ?? []
    list.push({ date: row.date, close: Number(row.close) })
    pricesByTicker.set(row.ticker, list)
  }

  const upserts: any[] = []

  for (const row of (backtestRows as any[]) || []) {
    const ticker = row.ticker
    let rawSignals = (row.signals_5y_weekly as any[]) || []
    const dailyPrices = pricesByTicker.get(ticker) || []

    if (dailyPrices.length === 0) continue

    // Filter by finalMult, and limit to recent signals only if incremental
    rawSignals = rawSignals.filter((s: any) => s.finalMult > 0 && s.date)
    if (!fullMode) rawSignals = rawSignals.slice(-SIGNAL_LIMIT)

    const signals: any[] = []
    for (const sig of rawSignals) {
      if (!fullMode && new Date(sig.date).getTime() < Date.now() - INCREMENTAL_WINDOW_DAYS * 24 * 60 * 60 * 1000) continue

      const pricesUpToSignal = dailyPrices.filter(p => p.date <= sig.date)
      if (pricesUpToSignal.length === 0) continue

      const volMapDaily = computeEWMAVol(pricesUpToSignal)
      const mrDaily = computeMeanReversion(pricesUpToSignal)
      const momentumVector = factorsByDate.get(sig.date) || []

      const factorRegimeScore = getPCAModifier(assetLoadings.get(ticker.toUpperCase()), momentumVector)
      const volTimingScore = getVolBonus(volMapDaily.get(sig.date))
      const meanReversionScore = getMeanReversionBonus(mrDaily.zScoreByDate.get(sig.date), mrDaily.halfLifeDays)

      signals.push({
        date: sig.date,
        finalMult: sig.finalMult,
        performance: sig.performance ?? null,
        exitDate: sig.exitDate ?? null,
        exitReturn: sig.exitReturn ?? null,
        exitScore: sig.exitScore ?? null,
        exitOpen: sig.exitOpen ?? true,
        factorRegimeScore,
        volTimingScore,
        meanReversionScore,
      })
    }

    if (signals.length > 0) {
      upserts.push({
        ticker,
        signals,
        latest_date: dailyPrices[dailyPrices.length - 1].date,
        updated_at: new Date().toISOString(),
      })
    }
  }

  if (upserts.length > 0) {
    const { error } = await supabase.from('weekly_signal_enrichment').upsert(upserts, { onConflict: 'ticker' })
    if (error) throw error
  }

  return upserts.length
}

async function main() {
  console.log(`Starting ${fullMode ? 'full' : 'incremental'} weekly enrichment...`)
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
    const count = await computeBatch(batch, factorsByDate, assetLoadings)
    totalProcessed += count
    console.log(`  [${i + batch.length}/${assets.length}] processed ${count} tickers`)
  }

  console.log(`\n✓ Weekly enrichment complete: ${totalProcessed} tickers updated`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
