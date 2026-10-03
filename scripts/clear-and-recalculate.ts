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

async function clear() {
  console.log('Clearing macro tables...\n')

  console.log('1. Deleting all rows from asset_backtest_macro...')
  const { error: macroError } = await supabase
    .from('asset_backtest_macro')
    .delete()
    .neq('ticker', 'INVALID_NEVER_MATCHES')

  if (macroError) {
    console.log('   ERROR:', macroError.message)
  } else {
    console.log('   ✓ Cleared')
  }

  console.log('\n2. Deleting all rows from backtest_summary_macro...')
  const { error: summaryError } = await supabase
    .from('backtest_summary_macro')
    .delete()
    .neq('ticker', 'INVALID_NEVER_MATCHES')

  if (summaryError) {
    console.log('   ERROR:', summaryError.message)
  } else {
    console.log('   ✓ Cleared')
  }

  console.log('\n✓ Tables cleared. Now run:')
  console.log('   npx ts-node --project tsconfig.scripts.json scripts/calculate-asset-backtest-macro-simple.ts')
  console.log('   npx ts-node --project tsconfig.scripts.json scripts/populate-backtest-summary-macro.ts')
}

clear()
