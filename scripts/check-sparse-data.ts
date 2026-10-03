import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env.local
const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  try {
    console.log('Querying tickers with sparse data (<200 bars)...\n')

    // Fetch all tickers and their bar counts
    const { data: allData, error } = await supabase
      .from('daily_prices')
      .select('ticker')

    if (error) {
      console.error('Error fetching data:', error)
      process.exit(1)
    }

    // Count bars per ticker
    const tickerCounts = new Map<string, number>()
    for (const row of allData || []) {
      const ticker = (row as any).ticker
      tickerCounts.set(ticker, (tickerCounts.get(ticker) || 0) + 1)
    }

    // Filter for < 200 bars and sort
    const sparseData = Array.from(tickerCounts.entries())
      .filter(([_, count]) => count < 200)
      .sort((a, b) => a[1] - b[1])

    if (sparseData.length === 0) {
      console.log('No tickers found with fewer than 200 bars.\n')
      console.log('All active tickers have complete 5-year data (1250+ bars).')
      return
    }

    console.log('Tickers with fewer than 200 bars:')
    console.log('==========================================')
    console.log('ticker'.padEnd(10) + 'bars')
    console.log('==========================================')

    for (const [ticker, count] of sparseData) {
      console.log(ticker.padEnd(10) + count)
    }

    console.log('==========================================')
    console.log(`Total tickers with sparse data: ${sparseData.length}`)
    console.log('==========================================\n')

  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

main()
