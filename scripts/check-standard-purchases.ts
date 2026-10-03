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
    .select('ticker, std_purchases_1y, enh_purchases_1y, std_purchases_3y, enh_purchases_3y, std_purchases_5y, enh_purchases_5y')
    .eq('ticker', 'COF')
    .single()

  console.log('backtest_summary for COF (ALL purchases):')
  console.log('  std_purchases_1y:', data?.std_purchases_1y)
  console.log('  enh_purchases_1y:', data?.enh_purchases_1y)
  console.log('  std_purchases_3y:', data?.std_purchases_3y)
  console.log('  enh_purchases_3y:', data?.enh_purchases_3y)
  console.log('  std_purchases_5y:', data?.std_purchases_5y)
  console.log('  enh_purchases_5y:', data?.enh_purchases_5y)
}

check()
