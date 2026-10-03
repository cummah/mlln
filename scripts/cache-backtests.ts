import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { runTVEnhancedDCA, PriceBar } from '../lib/dcaEngine'

// Load .env.local so Supabase keys are available
const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

interface BacktestCacheRow {
  ticker: string
  rsi_length: number
  std_invested: number
  std_shares: number
  std_avg_entry: number
  std_net_pct: number
  enh_invested: number
  enh_shares: number
  enh_avg_entry: number
  enh_net_pct: number
  alpha: number
  total_weeks: number
  date_range_from: string
  date_range_to: string
  last_updated: string
}

async function main() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    console.log('==========================================')
    console.log('      Cache Backtests (DCA Analysis)')
    console.log('==========================================\n')

    // 1. Fetch all active tickers
    console.log('Fetching active tickers from assets table...')
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('ticker')
      .eq('is_active', true)

    if (assetsError || !assets) {
      console.error('Error fetching assets:', assetsError)
      process.exit(1)
    }

    const tickers = assets.map(a => a.ticker)
    console.log(`Found ${tickers.length} active tickers\n`)

    // 2. Process each ticker
    let processedCount = 0
    let successCount = 0
    let failureCount = 0
    const startTime = Date.now()
    const rowsToUpsert: BacktestCacheRow[] = []

    for (const ticker of tickers) {
      try {
        // Fetch price data for this ticker
        const { data: prices, error: pricesError } = await supabase
          .from('daily_prices')
          .select('date, open, high, low, close, volume')
          .eq('ticker', ticker)
          .order('date', { ascending: true })

        if (pricesError || !prices || prices.length < 200) {
          // Skip tickers without enough data
          processedCount++
          continue
        }

        // Convert to PriceBar format
        const bars: PriceBar[] = prices.map(p => ({
          date: p.date,
          open: Number(p.open),
          high: Number(p.high),
          low: Number(p.low),
          close: Number(p.close),
          volume: Number(p.volume),
        }))

        // Run DCA analysis with both RSI lengths
        for (const rsiLength of [7, 14]) {
          try {
            const result = runTVEnhancedDCA(bars, { rsiLength, frequency: 'weekly' })
            const backtest = result.backtest

            const totalWeeks = Math.round((bars.length / 5) || 52)
            const row: BacktestCacheRow = {
              ticker,
              rsi_length: rsiLength,
              std_invested: backtest.std.totalInvested,
              std_shares: backtest.std.totalShares,
              std_avg_entry: backtest.std.avgEntry,
              std_net_pct: backtest.std.netProfitPct,
              enh_invested: backtest.enh.totalInvested,
              enh_shares: backtest.enh.totalShares,
              enh_avg_entry: backtest.enh.avgEntry,
              enh_net_pct: backtest.enh.netProfitPct,
              alpha: backtest.alpha,
              total_weeks: totalWeeks,
              date_range_from: backtest.dateRange.from,
              date_range_to: backtest.dateRange.to,
              last_updated: new Date().toISOString(),
            }

            rowsToUpsert.push(row)
          } catch (err) {
            // Skip this RSI length if runTVEnhancedDCA fails
            const errorMsg = err instanceof Error ? err.message : String(err)
            console.error(`  Error running DCA for ${ticker} (RSI=${rsiLength}): ${errorMsg}`)
          }
        }

        processedCount++
        successCount++

        if (processedCount % 20 === 0) {
          console.log(`Progress: ${processedCount}/${tickers.length} tickers processed`)
        }
      } catch (err) {
        failureCount++
        processedCount++
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error(`Error processing ${ticker}: ${errorMsg}`)
      }
    }

    console.log(`\nProcessed ${processedCount}/${tickers.length} tickers`)
    console.log(`Rows to upsert: ${rowsToUpsert.length} (${successCount} successful tickers × 2 RSI lengths)\n`)

    // 3. Upsert all results to backtest_cache table
    if (rowsToUpsert.length > 0) {
      console.log('Upserting to backtest_cache table...')
      const { error: upsertError, count } = await supabase
        .from('backtest_cache')
        .upsert(rowsToUpsert, { onConflict: 'ticker,rsi_length' })

      if (upsertError) {
        console.error('Error upserting backtest cache:', upsertError)
        process.exit(1)
      }

      console.log(`✓ Successfully upserted ${rowsToUpsert.length} rows\n`)
    } else {
      console.log('No valid data to upsert\n')
    }

    // 4. Print final summary
    const endTime = Date.now()
    const timeSeconds = ((endTime - startTime) / 1000).toFixed(2)

    console.log('==========================================')
    console.log('        CACHE BACKTESTS SUMMARY')
    console.log('==========================================')
    console.log(`Total tickers processed:   ${processedCount}`)
    console.log(`Tickers with data:         ${successCount}`)
    console.log(`Tickers skipped/failed:    ${failureCount}`)
    console.log(`Total cache entries:       ${rowsToUpsert.length}`)
    console.log(`Time taken:                ${timeSeconds}s`)
    console.log('==========================================\n')
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

main()
