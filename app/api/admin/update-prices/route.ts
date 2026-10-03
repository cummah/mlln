import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createYahooFinanceClient, fetchHistoricalSafe } from '@/lib/yahoo-prices'
import { fetchAllPages } from '@/lib/supabase'

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

export async function POST(request: Request) {
  try {
    // 1. Validate secret key
    const { searchParams } = new URL(request.url)
    const providedKey = searchParams.get('key')
    const secretKey = process.env.REFRESH_SECRET_KEY

    if (!secretKey) {
      console.error('REFRESH_SECRET_KEY not configured')
      return NextResponse.json(
        { error: 'Admin endpoint not configured' },
        { status: 500 }
      )
    }

    if (!providedKey || providedKey !== secretKey) {
      return NextResponse.json(
        { error: 'Invalid or missing secret key' },
        { status: 401 }
      )
    }

    console.log('Price update initiated at', new Date().toISOString())
    const startTime = Date.now()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const yf = createYahooFinanceClient()

    // 2. Fetch all active tickers
    console.log('Fetching active tickers from assets table...')
    let assets
    try {
      assets = await fetchAllPages((from, to) =>
        supabase.from('assets').select('ticker').eq('is_active', true).range(from, to)
      )
    } catch (assetsError) {
      console.error('Error fetching assets:', assetsError)
      return NextResponse.json(
        { error: 'Failed to fetch assets' },
        { status: 500 }
      )
    }

    const tickers = (assets as any[]).map((a: any) => a.ticker)
    console.log(`Found ${tickers.length} active tickers\n`)

    // 3. Query latest date per ticker in daily_prices. Querying the whole table
    // unfiltered (~1M rows) and sorting client-side was unusably slow; look up
    // each ticker's latest date individually (indexed, tiny result) instead.
    console.log('Querying latest dates in daily_prices...')
    const latestDateMap = new Map<string, string>()
    const LOOKUP_CONCURRENCY = 20
    for (let i = 0; i < tickers.length; i += LOOKUP_CONCURRENCY) {
      const batch = tickers.slice(i, i + LOOKUP_CONCURRENCY)
      await Promise.all(batch.map(async (ticker: string) => {
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

    console.log(`Found data for ${latestDateMap.size} tickers`)

    // 4. Fetch and upsert prices for each ticker
    let totalRowsUpserted = 0
    let processedCount = 0
    let skippedCount = 0
    const failedTickers: Array<{ ticker: string; error: string }> = []

    // Use yesterday as cutoff to avoid partial trading day that Yahoo hasn't finalized yet.
    // This prevents the null-close retry logic from silently dropping an entire day's fetch.
    const toDate = new Date()
    toDate.setDate(toDate.getDate() - 1)

    for (const ticker of tickers) {
      try {
        // Skip index tickers that start with ^ except ^VIX
        if (ticker.startsWith('^') && ticker !== '^VIX') {
          skippedCount++
          processedCount++
          if (processedCount % 10 === 0) {
            console.log(`Progress: ${processedCount}/${tickers.length} - ${ticker}: skipped (index)`)
          }
          await delay(150)
          continue
        }

        // Determine start date: use latest date in DB, or fallback to 2021-01-01 for new tickers
        let fromDate: Date
        const latestDateStr = latestDateMap.get(ticker)
        if (latestDateStr) {
          // Parse the date and add 1 day to avoid re-fetching the same day
          const latest = new Date(latestDateStr)
          fromDate = new Date(latest)
          fromDate.setDate(fromDate.getDate() + 1)
        } else {
          // New ticker, fallback to 2021-01-01
          fromDate = new Date('2021-01-01')
        }

        // Fetch historical data from Yahoo Finance
        const result = await fetchHistoricalSafe(yf, ticker, fromDate, toDate)

        if (!result || result.length === 0) {
          // No new data is not necessarily a failure (ticker may be up to date)
          processedCount++
          if (processedCount % 10 === 0) {
            console.log(`Progress: ${processedCount}/${tickers.length} - ${ticker}: 0 new bars`)
          }
          await delay(150)
          continue
        }

        // Transform to match daily_prices schema
        const prices: DailyPrice[] = result.map(bar => ({
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
        failedTickers.push({ ticker, error: errorMsg })
        processedCount++
        if (processedCount % 10 === 0) {
          console.log(`Progress: ${processedCount}/${tickers.length} - ${ticker}: ERROR`)
        }
      }

      // Rate limiting: wait 150ms between requests
      await delay(150)
    }

    // 5. Return summary
    const endTime = Date.now()
    const timeSeconds = ((endTime - startTime) / 1000).toFixed(2)

    const response = {
      status: 'success',
      timestamp: new Date().toISOString(),
      tickers_processed: processedCount,
      tickers_skipped: skippedCount,
      tickers_failed: failedTickers.length,
      rows_upserted: totalRowsUpserted,
      time: `${timeSeconds}s`,
      failed_tickers: failedTickers.length > 0 ? failedTickers : undefined,
    }

    console.log('Price update completed successfully')
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in price update:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
