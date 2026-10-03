/**
 * compute-daily-signals.ts
 *
 * Generates daily-frequency DCA signals for all active tickers and stores them
 * in the daily_signals table. Daily signals use the same DCA engine as weekly/monthly,
 * just parameterized with frequency='daily'. They represent daily buying opportunities
 * for investors using a daily DCA strategy.
 *
 * Each ticker gets signals_1y: the full 1-year backtest history of daily buy signals,
 * which is then enriched by compute-daily-signal-enrichment.ts with performance,
 * technical metrics, and alignment days.
 *
 * Run with: npm run compute:daily-signals
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { runTVEnhancedDCA, type PriceBar } from '../lib/dcaEngine'

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

async function computeDailySignals(ticker: string): Promise<void> {
  // Fetch ALL daily prices for this ticker (paginated — PostgREST caps at 1000 rows/request)
  const pricesData: any[] = []
  let page = 0
  while (true) {
    const { data, error } = await supabase
      .from('daily_prices')
      .select('date, open, high, low, close, volume')
      .eq('ticker', ticker.toUpperCase())
      .order('date', { ascending: true })
      .range(page * 1000, (page + 1) * 1000 - 1)

    if (error) {
      throw new Error(`Failed to fetch prices: ${error.message}`)
    }

    if (!data || data.length === 0) break
    pricesData.push(...data)
    if (data.length < 1000) break
    page++
  }

  if (pricesData.length === 0) {
    throw new Error(`No price data found for ${ticker}`)
  }

  // Convert to PriceBar format
  const bars: PriceBar[] = pricesData.map((p: any) => ({
    date: p.date,
    open: Number(p.open),
    high: Number(p.high),
    low: Number(p.low),
    close: Number(p.close),
    volume: Number(p.volume),
  }))

  // Run daily DCA with default settings
  const dailyResult = runTVEnhancedDCA(bars, {
    baseAmount: 100,
    frequency: 'daily',
    rsiLength: 7,
  })

  // Extract signals_1y from the backtest history
  // debugDCADays contains all daily signals with their metrics
  const signals_1y = (dailyResult.backtest.debugDCADays || [])
    .filter((d: any) => d.finalMult > 0 && d.date)
    .map((d: any) => ({
      date: d.date,
      rsi: d.rsi,
      rsiMult: d.rsiMult,
      emaDistancePct: d.emaDistancePct,
      emaMult: d.emaMult,
      adx: d.adx,
      plusDI: d.plusDI,
      minusDI: d.minusDI,
      regime: d.regime || 'ranging',
      regimeAdj: d.regimeAdj,
      drawdownPct: d.drawdownPct,
      ddBonus: d.ddBonus,
      vixBonus: d.vixBonus || 1,
      finalMult: d.finalMult,
      isCapped: d.isCapped || false,
    }))

  // Upsert into daily_signals table
  const { error: upsertError } = await supabase
    .from('daily_signals')
    .upsert(
      {
        ticker: ticker.toUpperCase(),
        signals_1y,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'ticker' }
    )

  if (upsertError) {
    throw new Error(`Failed to upsert daily signals: ${upsertError.message}`)
  }
}

async function main() {
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
    if (data.length < 1000) break
  }

  if (assets.length === 0) {
    console.log('No active assets found.')
    return
  }

  const tickers = (assets as any[]).map(a => a.ticker.toUpperCase())
  console.log(`Computing daily signals for ${tickers.length} tickers...\n`)

  const results = {
    success: 0,
    failed: 0,
    errors: [] as { ticker: string; error: string }[],
  }

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i]
    try {
      await computeDailySignals(ticker)
      results.success++
      if ((i + 1) % 50 === 0) {
        console.log(`[${i + 1}/${tickers.length}] ${ticker}: ✓`)
      }
    } catch (err) {
      results.failed++
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      results.errors.push({ ticker, error: errorMsg })
      console.error(`[${i + 1}/${tickers.length}] ${ticker}: ✗ ${errorMsg}`)
    }
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`Summary:`)
  console.log(`  Success: ${results.success}`)
  console.log(`  Failed: ${results.failed}`)

  if (results.errors.length > 0 && results.errors.length <= 10) {
    console.log(`\nFailed tickers:`)
    results.errors.forEach(e => console.log(`  ${e.ticker}: ${e.error}`))
  }

  console.log(`${'═'.repeat(60)}\n`)
}

main().catch(console.error)
