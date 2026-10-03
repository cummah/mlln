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
  console.log('=== Comparing BW Data ===\n')

  const { data: standard } = await supabase
    .from('backtest_summary')
    .select('std_return_5y, enh_return_5y, alpha_5y, std_return_3y, enh_return_3y, alpha_3y, std_return_1y, enh_return_1y, alpha_1y')
    .eq('ticker', 'BW')
    .single()

  const { data: macro } = await supabase
    .from('backtest_summary_macro')
    .select('std_return_5y, enh_return_5y, alpha_5y, std_return_3y, enh_return_3y, alpha_3y, std_return_1y, enh_return_1y, alpha_1y')
    .eq('ticker', 'BW')
    .single()

  const { data: macroBacktest } = await supabase
    .from('asset_backtest_macro')
    .select('macro_return_1y, macro_return_3y, macro_return_5y')
    .eq('ticker', 'BW')
    .single()

  console.log('backtest_summary (Dashboard - Enhanced DCA):')
  console.log('  1y: std=', standard?.std_return_1y, 'enh=', standard?.enh_return_1y, 'alpha=', standard?.alpha_1y)
  console.log('  3y: std=', standard?.std_return_3y, 'enh=', standard?.enh_return_3y, 'alpha=', standard?.alpha_3y)
  console.log('  5y: std=', standard?.std_return_5y, 'enh=', standard?.enh_return_5y, 'alpha=', standard?.alpha_5y)
  console.log()

  console.log('backtest_summary_macro (Asset - Macro Strategy):')
  console.log('  1y: std=', macro?.std_return_1y, 'enh=', macro?.enh_return_1y, 'alpha=', macro?.alpha_1y)
  console.log('  3y: std=', macro?.std_return_3y, 'enh=', macro?.enh_return_3y, 'alpha=', macro?.alpha_3y)
  console.log('  5y: std=', macro?.std_return_5y, 'enh=', macro?.enh_return_5y, 'alpha=', macro?.alpha_5y)
  console.log()

  console.log('asset_backtest_macro (Raw macro returns):')
  console.log('  1y: macro_return=', macroBacktest?.macro_return_1y)
  console.log('  3y: macro_return=', macroBacktest?.macro_return_3y)
  console.log('  5y: macro_return=', macroBacktest?.macro_return_5y)
}

check()
