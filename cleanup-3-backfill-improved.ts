import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import YahooFinance from 'yahoo-finance2'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.resolve(__dirname, '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

interface DailyPrice {
  ticker: string
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const startTime = Date.now()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const yf = new YahooFinance({
    suppressNotices: ['ripHistorical'],
  })

  try {
    console.log('==========================================')
    console.log('    IMPROVED BACKFILL WITH RATE LIMITING')
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

    const allTickers = assets.map(a => a.ticker)
    console.log(`Found ${allTickers.length} active tickers\n`)

    // 2. Check which tickers already have data
    console.log('Checking which tickers already have complete data...\n')
    const tickersToFetch: string[] = []
    const alreadyComplete: string[] = []

    for (const ticker of allTickers) {
      const { count } = await supabase
        .from('daily_prices')
        .select('*', { count: 'exact' })
        .eq('ticker', ticker)
        .limit(0)

      if ((count || 0) >= 1000) {
        alreadyComplete.push(ticker)
      } else {
        tickersToFetch.push(ticker)
      }
    }

    console.log(`Already complete: ${alreadyComplete.length}`)
    console.log(`Need to backfill: ${tickersToFetch.length}\n`)

    // 3. Fetch and upsert prices
    console.log(`==========================================`)
    console.log(`         FETCHING ${tickersToFetch.length} TICKERS`)
    console.log(`==========================================\n`)

    let totalRowsUpserted = 0
    let successCount = 0
    let failureCount = 0
    const failedTickers: Array<{ ticker: string; error: string }> = []

    const fromDate = new Date('2021-01-01')
    const toDate = new Date()

    // RATE LIMITING: 1 request per 2 seconds (conservative)
    const delayMs = 2000

    for (let i = 0; i < tickersToFetch.length; i++) {
      const ticker = tickersToFetch[i]
      const progress = `[${i + 1}/${tickersToFetch.length}]`

      try {
        // Skip index tickers (except ^VIX)
        if (ticker.startsWith('^') && ticker !== '^VIX') {
          console.log(`${progress} ${ticker}: SKIPPED (index)`)
          await delay(100)
          continue
        }

        console.log(`${progress} ${ticker}: Fetching...`)

        // Fetch from Yahoo Finance
        const result = await yf.historical(ticker, {
          period1: fromDate,
          period2: toDate,
          interval: '1d',
        })

        if (!result || result.length === 0) {
          console.log(`${progress} ${ticker}: FAILED (no data from Yahoo Finance)`)
          failedTickers.push({ ticker, error: 'No data returned' })
          failureCount++
          await delay(delayMs)
          continue
        }

        // Transform data
        const prices: DailyPrice[] = result.map(bar => ({
          ticker,
          date: new Date(bar.date).toISOString().split('T')[0],
          open: Number(bar.open),
          high: Number(bar.high),
          low: Number(bar.low),
          close: Number(bar.close),
          volume: Number(bar.volume),
        }))

        // Upsert to database
        const { error: upsertError } = await supabase
          .from('daily_prices')
          .upsert(prices, { onConflict: 'ticker,date' })

        if (upsertError) {
          console.log(`${progress} ${ticker}: FAILED (database error: ${upsertError.message})`)
          failedTickers.push({ ticker, error: upsertError.message })
          failureCount++
        } else {
          console.log(`${progress} ${ticker}: SUCCESS (${prices.length} rows)`)
          totalRowsUpserted += prices.length
          successCount++
        }

        // RATE LIMITING: Wait before next request
        await delay(delayMs)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.log(`${progress} ${ticker}: ERROR (${errorMsg})`)
        failedTickers.push({ ticker, error: errorMsg })
        failureCount++
        await delay(delayMs)
      }
    }

    // 4. Summary
    const endTime = Date.now()
    const timeSeconds = ((endTime - startTime) / 1000).toFixed(2)

    console.log('\n==========================================')
    console.log('         BACKFILL SUMMARY')
    console.log('==========================================')
    console.log(`Tickers processed:     ${successCount + failureCount}/${tickersToFetch.length}`)
    console.log(`Successful:            ${successCount}`)
    console.log(`Failed:                ${failureCount}`)
    console.log(`Total rows upserted:   ${totalRowsUpserted.toLocaleString()}`)
    console.log(`Already complete:      ${alreadyComplete.length}`)
    console.log(`Time taken:            ${timeSeconds}s`)

    if (failedTickers.length > 0) {
      console.log('\nFailed tickers:')
      failedTickers.slice(0, 20).forEach(({ ticker, error }) => {
        console.log(`  - ${ticker}: ${error}`)
      })
      if (failedTickers.length > 20) {
        console.log(`  ... and ${failedTickers.length - 20} more`)
      }
    }

    console.log('\n==========================================\n')

    // Exit with success/failure
    process.exit(failureCount > 0 ? 1 : 0)
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

main()
