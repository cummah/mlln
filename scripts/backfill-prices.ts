import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import YahooFinance from 'yahoo-finance2'
import { fileURLToPath } from 'url'

function createYahooFinanceClient() {
  return new YahooFinance({ suppressNotices: ['ripHistorical'] })
}

const NULL_VALUES_ERROR = 'SOME (but not all) null values'

// (Duplicated from lib/yahoo-prices.ts: this script uses import.meta.url, which
// forces ts-node into strict ESM resolution requiring extensioned relative
// imports — not worth changing project-wide tsconfig behavior for one script.)
async function fetchHistoricalWindow(
  yf: ReturnType<typeof createYahooFinanceClient>,
  symbol: string,
  period1: Date,
  period2: Date,
  maxRetries: number
): Promise<any[]> {
  const end = new Date(period2)
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (end < period1) return []
    try {
      const result = await yf.historical(symbol, { period1, period2: end, interval: '1d' })
      return result || []
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.includes(NULL_VALUES_ERROR) || attempt === maxRetries) throw err
      end.setDate(end.getDate() - 1)
    }
  }
  return []
}

// yahoo-finance2's historical() validates the whole response and throws if ANY
// bar has a null close — which happens for the most recent trading day before
// Yahoo finalizes it. That throw discards all the good data along with the one
// bad bar, silently zeroing out an entire ticker's fetch. Retry with the window
// trimmed back a day at a time until a clean range is found.
//
// Dual-class share tickers (BRK.A, LEN.B, ...) are stored dotted in our DB but
// Yahoo indexes them with a hyphen (BRK-A, LEN-B). If the dotted symbol fails
// outright, retry once with the hyphenated form before giving up.
async function fetchHistoricalSafe(
  yf: ReturnType<typeof createYahooFinanceClient>,
  ticker: string,
  period1: Date,
  period2: Date,
  maxRetries = 5
): Promise<any[]> {
  try {
    return await fetchHistoricalWindow(yf, ticker, period1, period2, maxRetries)
  } catch (err) {
    if (!ticker.includes('.')) throw err
    return await fetchHistoricalWindow(yf, ticker.replace('.', '-'), period1, period2, maxRetries)
  }
}

// Load .env.local so Supabase keys are available
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.resolve(__dirname, '../.env.local')
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

  const yf = createYahooFinanceClient()

  try {
    // Parse command line arguments for --tickers flag
    const tickersArg = process.argv.find(arg => arg.startsWith('--tickers='))
    let tickers: string[] = []

    if (tickersArg) {
      // Use specific tickers provided via --tickers=AAPL,MSFT,GOOGL
      tickers = tickersArg.split('=')[1].split(',').map(t => t.trim())
      console.log(`Using specific tickers: ${tickers.join(', ')}\n`)
    } else {
      // 1. Fetch all active tickers from assets table (paginated — PostgREST caps at 1000 rows/request)
      console.log('Fetching active tickers from assets table...')
      const assets: Array<{ ticker: string }> = []
      const pageSize = 1000
      for (let page = 0; ; page++) {
        const { data, error: assetsError } = await supabase
          .from('assets')
          .select('ticker')
          .eq('is_active', true)
          .range(page * pageSize, page * pageSize + pageSize - 1)

        if (assetsError || !data) {
          console.error('Error fetching assets:', assetsError)
          process.exit(1)
        }
        assets.push(...data)
        if (data.length < pageSize) break
      }

      tickers = assets.map(a => a.ticker)
    }
    console.log(`Found ${tickers.length} active tickers\n`)

    // Default mode is incremental: only fetch bars newer than what's already in
    // daily_prices, same logic as app/api/admin/update-prices/route.ts. Refetching
    // and re-upserting full history for every active ticker on every run was
    // driving huge, unnecessary Supabase load. Pass --full to force a true
    // from-scratch backfill (e.g. after adding many new tickers).
    const fullBackfill = process.argv.includes('--full')
    console.log(`Mode: ${fullBackfill ? 'FULL backfill (2021-01-01 -> today)' : 'incremental (latest date + 1 -> today)'}\n`)

    const latestDateMap = new Map<string, string>()
    if (!fullBackfill) {
      console.log('Querying latest dates in daily_prices...')
      const LOOKUP_CONCURRENCY = 20
      for (let i = 0; i < tickers.length; i += LOOKUP_CONCURRENCY) {
        const batch = tickers.slice(i, i + LOOKUP_CONCURRENCY)
        await Promise.all(batch.map(async (ticker) => {
          const { data, error } = await supabase
            .from('daily_prices')
            .select('date')
            .eq('ticker', ticker)
            .order('date', { ascending: false })
            .limit(1)
          if (!error && data && data.length > 0) {
            const dateStr = typeof data[0].date === 'string' ? data[0].date : new Date(data[0].date).toISOString().split('T')[0]
            latestDateMap.set(ticker, dateStr)
          }
        }))
      }
      console.log(`Found existing data for ${latestDateMap.size}/${tickers.length} tickers\n`)
    }

    // 2. Fetch and upsert prices for each ticker
    let totalRowsUpserted = 0
    let processedCount = 0
    let skippedCount = 0
    const failedTickers: Array<{ ticker: string; error: string }> = []

    const toDate = new Date()

    for (const ticker of tickers) {
      try {
        // Skip index tickers that start with ^ as they're not supported by Yahoo Finance (except ^VIX)
        if (ticker.startsWith('^') && ticker !== '^VIX') {
          skippedCount++
          processedCount++
          if (processedCount % 10 === 0) {
            console.log(`Progress: ${processedCount}/${tickers.length} - ${ticker}: skipped (index)`)
          }
          await delay(150)
          continue
        }

        // Determine start date: full backfill always starts from 2021-01-01;
        // incremental mode resumes from the day after the latest stored bar,
        // falling back to 2021-01-01 for tickers with no data yet.
        let fromDate: Date
        if (fullBackfill) {
          fromDate = new Date('2021-01-01')
        } else {
          const latestDateStr = latestDateMap.get(ticker)
          if (latestDateStr) {
            fromDate = new Date(latestDateStr)
            fromDate.setDate(fromDate.getDate() + 1)
          } else {
            fromDate = new Date('2021-01-01')
          }
        }

        // Fetch historical data from Yahoo Finance
        // Use yesterday as cutoff to avoid partial trading day that Yahoo hasn't finalized yet
        const safeToDate = new Date(toDate)
        safeToDate.setDate(safeToDate.getDate() - 1)

        // In incremental mode, if fromDate > safeToDate, there's no new data to fetch
        // (the ticker's data is already current through yesterday)
        if (!fullBackfill && fromDate > safeToDate) {
          processedCount++
          if (processedCount % 10 === 0) {
            console.log(`Progress: ${processedCount}/${tickers.length} - ${ticker}: already current`)
          }
          await delay(150)
          continue
        }

        let result
        try {
          result = await fetchHistoricalSafe(yf, ticker, fromDate, safeToDate)

          // If we got 0 bars, extend the range backwards 5 days to cover weekends
          if (!result || result.length === 0) {
            const extendedFromDate = new Date(fromDate)
            extendedFromDate.setDate(extendedFromDate.getDate() - 5)
            result = await fetchHistoricalSafe(yf, ticker, extendedFromDate, safeToDate)
          }
        } catch (innerErr) {
          // If there's an error fetching, try a much larger range (last 2 years)
          const recentFromDate = new Date()
          recentFromDate.setFullYear(recentFromDate.getFullYear() - 2)
          result = await fetchHistoricalSafe(yf, ticker, recentFromDate, safeToDate)
        }

        if (!result || result.length === 0) {
          // In incremental mode this just means the ticker is already up to date.
          if (fullBackfill) {
            failedTickers.push({ ticker, error: 'No data returned from Yahoo Finance' })
          }
          processedCount++
          if (processedCount % 10 === 0) {
            console.log(`Progress: ${processedCount}/${tickers.length} - ${ticker}: 0 new bars`)
          }
          await delay(150)
          continue
        }

        // Transform to match daily_prices schema, filtering out incomplete bars
        const prices: DailyPrice[] = result
          .filter(bar => bar.open != null && bar.high != null && bar.low != null && bar.close != null && bar.volume != null)
          .map(bar => ({
            ticker,
            date: new Date(bar.date).toISOString().split('T')[0],
            open: Number(bar.open),
            high: Number(bar.high),
            low: Number(bar.low),
            close: Number(bar.close),
            volume: Number(bar.volume),
          }))

        // Upsert into daily_prices table
        const { error: upsertError } = await supabase
          .from('daily_prices')
          .upsert(prices, { onConflict: 'ticker,date' })

        if (upsertError) {
          failedTickers.push({ ticker, error: upsertError.message })
        } else {
          totalRowsUpserted += prices.length
        }

        processedCount++
        if (processedCount % 10 === 0) {
          console.log(
            `Progress: ${processedCount}/${tickers.length} - ${ticker}: ${prices.length} bars upserted`
          )
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        // If it's just the "null values" warning from Yahoo Finance, don't count as failed
        if (errorMsg.includes('Historical returned a result with SOME (but not all) null values')) {
          processedCount++
          if (processedCount % 10 === 0) {
            console.log(`Progress: ${processedCount}/${tickers.length} - ${ticker}: partial data (skipped)`)
          }
        } else {
          failedTickers.push({ ticker, error: errorMsg })
          processedCount++
          if (processedCount % 10 === 0) {
            console.log(`Progress: ${processedCount}/${tickers.length} - ${ticker}: ERROR`)
          }
        }
      }

      // Rate limiting: wait 150ms between requests
      await delay(150)
    }

    // 3. Print summary
    const endTime = Date.now()
    const timeSeconds = ((endTime - startTime) / 1000).toFixed(2)

    console.log('\n==========================================')
    console.log('         BACKFILL PRICES SUMMARY')
    console.log('==========================================')
    console.log(`Total tickers processed:   ${processedCount}/${tickers.length}`)
    console.log(`Total rows upserted:       ${totalRowsUpserted}`)
    console.log(`Total tickers skipped:     ${skippedCount} (index tickers)`)
    console.log(`Total tickers failed:      ${failedTickers.length}`)

    if (failedTickers.length > 0) {
      console.log('\nFailed tickers:')
      for (const { ticker, error } of failedTickers) {
        console.log(`  - ${ticker}: ${error}`)
      }
    }

    console.log(`\nTime taken:                ${timeSeconds}s`)
    console.log('==========================================\n')

    if (failedTickers.length > 0) {
      process.exit(1)
    }
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

main()
