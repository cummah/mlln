import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import YahooFinance from 'yahoo-finance2'
import { fileURLToPath } from 'url'

function createYahooFinanceClient() {
  return new YahooFinance({ suppressNotices: ['ripHistorical'] })
}

const NULL_VALUES_ERROR = 'SOME (but not all) null values'

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

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
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

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const yf = createYahooFinanceClient()

  console.log('Fetching all active assets...')
  const assets: Array<{ ticker: string }> = []
  const pageSize = 1000
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from('assets')
      .select('ticker')
      .eq('is_active', true)
      .range(page * pageSize, page * pageSize + pageSize - 1)

    if (error || !data) {
      console.error('Error fetching assets:', error)
      process.exit(1)
    }
    assets.push(...data)
    if (data.length < pageSize) break
  }

  console.log(`Found ${assets.length} active tickers\n`)

  let totalFilled = 0
  let tickersWithGaps = 0

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  for (const asset of assets) {
    const ticker = asset.ticker

    // Get latest date for this ticker
    const { data: latestData, error } = await supabase
      .from('daily_prices')
      .select('date')
      .eq('ticker', ticker)
      .order('date', { ascending: false })
      .limit(1)

    if (error || !latestData || latestData.length === 0) continue

    const latestDateStr = typeof latestData[0].date === 'string'
      ? latestData[0].date
      : new Date(latestData[0].date).toISOString().split('T')[0]

    // Check if we're missing data up to yesterday
    if (latestDateStr >= yesterdayStr) continue

    tickersWithGaps++
    const fromDate = new Date(latestDateStr)
    fromDate.setDate(fromDate.getDate() + 1)

    console.log(`\n${ticker}: Latest is ${latestDateStr}, filling to ${yesterdayStr}`)

    try {
      const result = await fetchHistoricalSafe(yf, ticker, fromDate, yesterday)

      if (result && result.length > 0) {
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

        const { error: upsertError } = await supabase
          .from('daily_prices')
          .upsert(prices, { onConflict: 'ticker,date' })

        if (upsertError) {
          console.log(`    ✗ Failed to upsert: ${upsertError.message}`)
        } else {
          console.log(`    ✓ Filled ${prices.length} bars`)
          totalFilled += prices.length
        }
      } else {
        console.log(`    ℹ No data available`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`    ✗ Error: ${msg}`)
    }

    await delay(200)
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`Summary:`)
  console.log(`  Tickers with gaps: ${tickersWithGaps}`)
  console.log(`  Total bars filled: ${totalFilled}`)
  console.log(`${'═'.repeat(60)}\n`)
}

main().catch(console.error)
