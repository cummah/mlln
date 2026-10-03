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
  const { data: macro } = await supabase
    .from('asset_backtest_macro')
    .select('*')
    .eq('ticker', 'IQV')
    .single()

  const { data: standard } = await supabase
    .from('backtest_summary')
    .select('enh_return_5y, enh_return_3y, enh_return_1y, sector')
    .eq('ticker', 'IQV')
    .single()

  const { data: metrics } = await supabase
    .from('asset_macro_metrics')
    .select('dca_return_5y, dca_return_3y, dca_return_1y, macro_return_5y, macro_return_3y, macro_return_1y')
    .eq('ticker', 'IQV')
    .single()

  console.log('Backtest Summary (enh_return):')
  console.log(JSON.stringify(standard, null, 2))
  console.log('\nAsset Backtest Macro:')
  console.log(JSON.stringify(macro, null, 2))
  console.log('\nAsset Macro Metrics:')
  console.log(JSON.stringify(metrics, null, 2))
}

check()
