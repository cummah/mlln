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
  console.log('=== COF Purchase Counts ===\n')

  const { data: macro, error: macroError } = await supabase
    .from('backtest_summary_macro')
    .select('std_purchases_1y, enh_purchases_1y, std_purchases_3y, enh_purchases_3y, std_purchases_5y, enh_purchases_5y')
    .eq('ticker', 'COF')
    .single()

  if (macroError) {
    console.log('Error:', macroError.message)
    return
  }

  console.log('backtest_summary_macro (Macro Strategy):')
  console.log('  1y:')
  console.log('    std_purchases:', macro?.std_purchases_1y)
  console.log('    enh_purchases:', macro?.enh_purchases_1y)
  console.log('  3y:')
  console.log('    std_purchases:', macro?.std_purchases_3y)
  console.log('    enh_purchases:', macro?.enh_purchases_3y)
  console.log('  5y:')
  console.log('    std_purchases:', macro?.std_purchases_5y)
  console.log('    enh_purchases:', macro?.enh_purchases_5y)
  console.log()

  // Also check backtest_summary for comparison
  const { data: standard } = await supabase
    .from('backtest_summary')
    .select('std_purchases_1y, enh_purchases_1y, std_purchases_3y, enh_purchases_3y, std_purchases_5y, enh_purchases_5y')
    .eq('ticker', 'COF')
    .single()

  console.log('backtest_summary (Enhanced DCA - for comparison):')
  console.log('  1y:')
  console.log('    std_purchases:', standard?.std_purchases_1y)
  console.log('    enh_purchases:', standard?.enh_purchases_1y)
  console.log('  3y:')
  console.log('    std_purchases:', standard?.std_purchases_3y)
  console.log('    enh_purchases:', standard?.enh_purchases_3y)
  console.log('  5y:')
  console.log('    std_purchases:', standard?.std_purchases_5y)
  console.log('    enh_purchases:', standard?.enh_purchases_5y)
}

check()
