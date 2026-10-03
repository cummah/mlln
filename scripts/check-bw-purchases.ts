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
    .from('backtest_summary_macro')
    .select('std_purchases_1y, enh_purchases_1y, std_purchases_3y, enh_purchases_3y, std_purchases_5y, enh_purchases_5y')
    .eq('ticker', 'BW')
    .single()

  console.log('BW Purchase Counts (Macro Strategy):')
  console.log('  1y: std=', macro?.std_purchases_1y, 'macro=', macro?.enh_purchases_1y)
  console.log('  3y: std=', macro?.std_purchases_3y, 'macro=', macro?.enh_purchases_3y)
  console.log('  5y: std=', macro?.std_purchases_5y, 'macro=', macro?.enh_purchases_5y)
}

check()
