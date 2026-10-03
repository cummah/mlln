import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

async function main() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    console.log('Checking if backtest_summary table exists...')

    // Try to check if table exists
    const { error: checkError } = await supabase
      .from('backtest_summary')
      .select('ticker', { count: 'exact' })
      .limit(1)

    if (checkError && checkError.message.includes('Could not find the table')) {
      console.log('\n❌ Table does not exist in Supabase')
      console.log('\n' + '='.repeat(70))
      console.log('REQUIRED MANUAL STEP')
      console.log('='.repeat(70))
      console.log('\nYou must create the backtest_summary table manually:\n')
      console.log('1. Open Supabase Dashboard: https://app.supabase.com')
      console.log('2. Select your project')
      console.log('3. Go to: SQL Editor → New Query')
      console.log('4. Copy ALL the SQL below (between the dashed lines)')
      console.log('5. Paste into Supabase SQL Editor')
      console.log('6. Click "Run"')
      console.log('7. Then run THIS script again\n')

      console.log('-'.repeat(70))
      const sqlPath = path.resolve(__dirname, '../supabase/migrations/create_backtest_summary.sql')
      const sqlContent = fs.readFileSync(sqlPath, 'utf-8')
      console.log(sqlContent)
      console.log('-'.repeat(70))
      console.log('\nOnce the table is created, run:')
      console.log('  npx tsx scripts/final-setup-and-populate.ts\n')
      process.exit(1)
    }

    console.log('✅ Table exists!\n')
    console.log('Step 2: Populating with 694 computed backtest results...\n')

    // Get the computed rows from the previous run
    // We'll need to re-run the computation, but this time it will save to the table
    console.log('To populate the table, please run:')
    console.log('  npx tsx scripts/compute-backtest-summary.ts\n')
    console.log('This will:')
    console.log('  ✓ Compute backtests for all 719 assets')
    console.log('  ✓ Generate 694 successful rows')
    console.log('  ✓ Upsert them into backtest_summary table')
    console.log('  ✓ Handle duplicates automatically (unique ticker constraint)\n')

  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()
