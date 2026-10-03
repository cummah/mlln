import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env.local
const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function checkLatestDates() {
  const tickers = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'META']

  console.log('Checking latest dates in database...\n')

  for (const ticker of tickers) {
    const { data, error } = await supabase
      .from('daily_prices')
      .select('date')
      .eq('ticker', ticker)
      .order('date', { ascending: false })
      .limit(1)

    if (error) {
      console.log(`${ticker}: ERROR - ${error.message}`)
    } else if (data && data.length > 0) {
      const latestDate = data[0].date
      console.log(`${ticker}: ${latestDate}`)
    } else {
      console.log(`${ticker}: NO DATA`)
    }
  }

  // Also check the count of rows for one ticker
  console.log('\n\nChecking row count for AAPL...')
  const { count } = await supabase
    .from('daily_prices')
    .select('*', { count: 'exact' })
    .eq('ticker', 'AAPL')

  console.log(`Total AAPL rows: ${count}`)
}

checkLatestDates().catch(console.error)
