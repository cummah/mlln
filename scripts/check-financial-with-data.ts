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

async function check() {
  const { data } = await supabase
    .from('backtest_summary')
    .select('ticker')
    .order('ticker')
    .limit(1000)

  if (!data) {
    console.log('No backtest data found')
    return
  }

  const tickers = data.map((d: any) => d.ticker)

  const { data: financials } = await supabase
    .from('assets')
    .select('ticker')
    .eq('sector', 'Financials')
    .in('ticker', tickers)
    .limit(5)

  console.log('Financials with backtest data:')
  financials?.forEach((f: any) => console.log(`  ${f.ticker}`))
}

check()
