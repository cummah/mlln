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

async function verify() {
  console.log('=== Macro Data Verification ===\n')

  const tickers = ['BW', 'COF', 'AMP']

  for (const ticker of tickers) {
    const { data } = await supabase
      .from('backtest_summary_macro')
      .select('ticker, std_purchases_1y, enh_purchases_1y, std_purchases_3y, enh_purchases_3y, std_purchases_5y, enh_purchases_5y, std_return_1y, enh_return_1y, alpha_1y')
      .eq('ticker', ticker)
      .single()

    if (data) {
      console.log(`${ticker}:`)
      console.log(`  1y: std=${data.std_purchases_1y}, enh=${data.enh_purchases_1y}, return_std=${data.std_return_1y}%, return_enh=${data.enh_return_1y}%, alpha=${data.alpha_1y}%`)
      console.log(`  3y: std=${data.std_purchases_3y}, enh=${data.enh_purchases_3y}`)
      console.log(`  5y: std=${data.std_purchases_5y}, enh=${data.enh_purchases_5y}`)
      console.log()
    }
  }
}

verify()
