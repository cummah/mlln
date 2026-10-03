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
    .from('asset_backtest_macro')
    .select('ticker, macro_buy_count_1y, macro_buy_count_3y, macro_buy_count_5y')
    .eq('ticker', 'COF')
    .single()

  console.log('asset_backtest_macro for COF:')
  console.log('  macro_buy_count_1y:', data?.macro_buy_count_1y)
  console.log('  macro_buy_count_3y:', data?.macro_buy_count_3y)
  console.log('  macro_buy_count_5y:', data?.macro_buy_count_5y)
}

check()
