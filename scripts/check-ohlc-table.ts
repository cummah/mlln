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

async function checkOHLCTable() {
  const ticker = 'AAPL'

  console.log('Checking ohlc_daily table...')

  // Try to fetch from ohlc_daily
  const { data: ohlcData, error: ohlcError } = await supabase
    .from('ohlc_daily')
    .select('date')
    .eq('ticker', ticker)
    .order('date', { ascending: false })
    .limit(1)

  if (ohlcError) {
    console.log(`ohlc_daily table error: ${ohlcError.message}`)
    console.log('Table probably does not exist or is inaccessible')
  } else if (ohlcData && ohlcData.length > 0) {
    console.log(`ohlc_daily EXISTS with latest date: ${ohlcData[0].date}`)
    console.log('⚠️  This is likely the cause! Stale data in ohlc_daily table')
  } else {
    console.log('ohlc_daily table exists but has no data for AAPL')
  }

  // Check daily_prices for reference
  console.log('\nChecking daily_prices table...')
  const { data: dailyData } = await supabase
    .from('daily_prices')
    .select('date')
    .eq('ticker', ticker)
    .order('date', { ascending: false })
    .limit(1)

  if (dailyData && dailyData.length > 0) {
    console.log(`daily_prices has latest date: ${dailyData[0].date}`)
  }
}

checkOHLCTable().catch(console.error)
