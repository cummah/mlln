import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

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

const TICKER = process.argv[2]?.toUpperCase() || 'CAR'

const KEYS = [
  'ticker', 'name', 'sector', 'updated_at',
  'std_return_1y', 'enh_return_1y', 'alpha_1y', 'std_invested_1y', 'enh_invested_1y',
  'std_value_1y', 'enh_value_1y', 'std_purchases_1y', 'enh_purchases_1y',
  'std_return_5y', 'enh_return_5y', 'alpha_5y', 'std_invested_5y', 'enh_invested_5y',
  'std_value_5y', 'enh_value_5y', 'std_purchases_5y', 'enh_purchases_5y',
  'std_avg_entry_5y', 'enh_avg_entry_5y',
  'monthly_std_return_5y', 'monthly_enh_return_5y', 'monthly_alpha_5y',
  'monthly_std_invested_5y', 'monthly_enh_invested_5y',
  'monthly_std_value_5y', 'monthly_enh_value_5y',
  'dca_suitability_score',
]

async function main() {
  for (const table of ['backtest_summary', 'backtest_summary_macro']) {
    const { data, error } = await supabase.from(table).select('*').eq('ticker', TICKER).single()
    console.log(`\n=== ${table} (${TICKER}) ===`)
    if (error) { console.log('ERROR:', error.message); continue }
    for (const k of KEYS) {
      console.log(`${k}: ${JSON.stringify((data as any)[k])}`)
    }
    // Show any columns not in KEYS that are non-null, to spot extra fields
    const extras = Object.keys(data as any).filter(k => !KEYS.includes(k))
    console.log('other columns:', extras.join(', '))
  }

  // Also check latest price and asset info
  const { data: asset } = await supabase.from('assets').select('*').eq('ticker', TICKER).single()
  console.log(`\n=== assets (${TICKER}) ===`)
  console.log(JSON.stringify(asset, null, 2))

  const { data: prices } = await supabase.from('daily_prices')
    .select('date, close').eq('ticker', TICKER)
    .order('date', { ascending: false }).limit(3)
  console.log(`\n=== latest daily_prices (${TICKER}) ===`)
  console.log(JSON.stringify(prices, null, 2))
}

main()
