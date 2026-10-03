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
  console.log('=== Checking COF data in both tables ===\n')

  // Get data from backtest_summary (Enhanced DCA)
  const { data: standardData, error: standardError } = await supabase
    .from('backtest_summary')
    .select('ticker, std_return_5y, enh_return_5y, std_invested_5y, enh_invested_5y, std_value_5y, enh_value_5y, alpha_5y')
    .eq('ticker', 'COF')
    .single()

  if (standardError) {
    console.log('ERROR fetching from backtest_summary:', standardError.message)
  } else {
    console.log('backtest_summary (Enhanced DCA) for COF:')
    console.log('  std_return_5y:', standardData?.std_return_5y)
    console.log('  enh_return_5y:', standardData?.enh_return_5y)
    console.log('  alpha_5y:', standardData?.alpha_5y)
    console.log('  std_invested_5y:', standardData?.std_invested_5y)
    console.log('  enh_invested_5y:', standardData?.enh_invested_5y)
    console.log()
  }

  // Get data from backtest_summary_macro (Macro strategy)
  const { data: macroData, error: macroError } = await supabase
    .from('backtest_summary_macro')
    .select('ticker, std_return_5y, enh_return_5y, std_invested_5y, enh_invested_5y, std_value_5y, enh_value_5y, alpha_5y')
    .eq('ticker', 'COF')
    .single()

  if (macroError) {
    console.log('ERROR fetching from backtest_summary_macro:', macroError.message)
    console.log('\n⚠️  The backtest_summary_macro table may not exist yet or has no data for COF')
    console.log('   Next steps:')
    console.log('   1. Apply migration in Supabase dashboard')
    console.log('   2. Run: npx ts-node --project tsconfig.scripts.json scripts/populate-backtest-summary-macro.ts')
  } else {
    console.log('backtest_summary_macro (Macro Strategy) for COF:')
    console.log('  std_return_5y:', macroData?.std_return_5y)
    console.log('  enh_return_5y:', macroData?.enh_return_5y)
    console.log('  alpha_5y:', macroData?.alpha_5y)
    console.log('  std_invested_5y:', macroData?.std_invested_5y)
    console.log('  enh_invested_5y:', macroData?.enh_invested_5y)
    console.log()

    // Compare
    console.log('=== COMPARISON ===')
    console.log('Standard DCA (should be same in both):')
    console.log('  backtest_summary.std_return_5y:', standardData?.std_return_5y)
    console.log('  backtest_summary_macro.std_return_5y:', macroData?.std_return_5y)
    console.log('  Match:', standardData?.std_return_5y === macroData?.std_return_5y ? '✓' : '✗')
    console.log()

    console.log('Enhanced/Macro Return (should be DIFFERENT):')
    console.log('  backtest_summary.enh_return_5y (Enhanced DCA):', standardData?.enh_return_5y)
    console.log('  backtest_summary_macro.enh_return_5y (Macro):', macroData?.enh_return_5y)
    console.log('  Different:', standardData?.enh_return_5y !== macroData?.enh_return_5y ? '✓' : '✗ (PROBLEM!)')
    console.log()

    console.log('Alpha (should be DIFFERENT):')
    console.log('  backtest_summary.alpha_5y:', standardData?.alpha_5y)
    console.log('  backtest_summary_macro.alpha_5y:', macroData?.alpha_5y)
    console.log('  Different:', standardData?.alpha_5y !== macroData?.alpha_5y ? '✓' : '✗ (PROBLEM!)')
  }
}

check()
