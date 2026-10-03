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
  console.log('=== Setup Verification ===\n')

  // Check if table exists
  console.log('1. Checking if backtest_summary_macro table exists...')
  try {
    const { data, error } = await supabase
      .from('backtest_summary_macro')
      .select('count(*)', { count: 'exact' })
      .limit(1)

    if (error) {
      console.log('   ✗ ERROR:', error.message)
      console.log('   → Migration has NOT been applied yet')
    } else {
      console.log('   ✓ Table exists')
    }
  } catch (err) {
    console.log('   ✗ Exception:', (err as any).message)
  }

  console.log()

  // Count rows
  console.log('2. Counting rows in backtest_summary_macro...')
  try {
    const { count, error } = await supabase
      .from('backtest_summary_macro')
      .select('*', { count: 'exact', head: true })

    if (error) {
      console.log('   ✗ ERROR:', error.message)
    } else {
      console.log(`   ✓ ${count} rows found`)
      if (count === 0) {
        console.log('   → Table is empty. Run populate-backtest-summary-macro.ts')
      } else if (count && count > 0) {
        console.log('   ✓ Data is populated')
      }
    }
  } catch (err) {
    console.log('   ✗ Exception:', (err as any).message)
  }

  console.log()

  // Check specific COF data
  console.log('3. Checking COF data in backtest_summary_macro...')
  try {
    const { data, error } = await supabase
      .from('backtest_summary_macro')
      .select('ticker, enh_return_5y, alpha_5y')
      .eq('ticker', 'COF')
      .single()

    if (error) {
      console.log('   ✗ ERROR:', error.message)
      console.log('   → COF not found in table')
    } else {
      console.log('   ✓ Found COF')
      console.log(`      enh_return_5y: ${data.enh_return_5y}%`)
      console.log(`      alpha_5y: ${data.alpha_5y}%`)
    }
  } catch (err) {
    console.log('   ✗ Exception:', (err as any).message)
  }

  console.log()
  console.log('=== Summary ===')
  console.log('If you see errors above, follow these steps:')
  console.log()
  console.log('Step 1: Apply the migration in Supabase Dashboard')
  console.log('   File: supabase/migrations/20260530_create_backtest_summary_macro.sql')
  console.log()
  console.log('Step 2: Run the populate script')
  console.log('   npx ts-node --project tsconfig.scripts.json scripts/populate-backtest-summary-macro.ts')
  console.log()
  console.log('Step 3: Restart dev server')
  console.log('   npm run dev')
}

verify()
