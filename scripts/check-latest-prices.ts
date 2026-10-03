import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

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

  const tickers = ['AAPL', 'MSFT', 'AMZN', 'TSLA', 'NVDA']

  console.log('Latest prices by ticker:')
  for (const ticker of tickers) {
    const { data, error } = await supabase
      .from('daily_prices')
      .select('date')
      .eq('ticker', ticker)
      .order('date', { ascending: false })
      .limit(1)

    if (data && data.length > 0) {
      console.log(`  ${ticker}: ${data[0].date}`)
    } else {
      console.log(`  ${ticker}: No data`)
    }
  }

  const { data: maxDate } = await supabase
    .from('daily_prices')
    .select('date')
    .order('date', { ascending: false })
    .limit(1)

  console.log(`\nLatest date in daily_prices table: ${maxDate?.[0]?.date || 'N/A'}`)
}

main().catch(console.error)
