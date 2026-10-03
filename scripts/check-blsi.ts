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
  const { data: standard } = await supabase
    .from('backtest_summary')
    .select('ticker, enh_return_5y, enh_return_3y, enh_return_1y, sector')
    .eq('ticker', 'BLSI')
    .single()

  const { data: macro } = await supabase
    .from('asset_backtest_macro')
    .select('ticker, macro_return_5y, macro_return_3y, macro_return_1y, alpha_vs_standard_5y, sector')
    .eq('ticker', 'BLSI')
    .single()

  const { data: metrics } = await supabase
    .from('asset_macro_metrics')
    .select('ticker, dca_return_5y, dca_return_3y, dca_return_1y, macro_return_5y, macro_return_3y, macro_return_1y, alpha_vs_standard_5y, current_macro_regime')
    .eq('ticker', 'BLSI')
    .single()

  console.log('=== BLSI (Financials Sector) ===\n')
  console.log('Backtest Summary (Enhanced DCA):')
  console.log(`  5Y Return: ${standard?.enh_return_5y}%`)
  console.log(`  3Y Return: ${standard?.enh_return_3y}%`)
  console.log(`  1Y Return: ${standard?.enh_return_1y}%`)
  console.log(`  Sector: ${standard?.sector}`)

  console.log('\nAsset Backtest Macro (Macro-Adjusted):')
  console.log(`  5Y Return: ${macro?.macro_return_5y}%`)
  console.log(`  3Y Return: ${macro?.macro_return_3y}%`)
  console.log(`  1Y Return: ${macro?.macro_return_1y}%`)
  console.log(`  Alpha vs Standard: ${macro?.alpha_vs_standard_5y}%`)

  console.log('\nAsset Macro Metrics (Combined):')
  console.log(`  DCA Return 5Y: ${metrics?.dca_return_5y}%`)
  console.log(`  Macro Return 5Y: ${metrics?.macro_return_5y}%`)
  console.log(`  Difference: ${(metrics?.macro_return_5y || 0) - (metrics?.dca_return_5y || 0)}%`)
  console.log(`  Alpha: ${metrics?.alpha_vs_standard_5y}%`)
  console.log(`  Current Macro Regime: ${metrics?.current_macro_regime}`)
}

check()
