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

    console.log('Step 1: Checking if backtest_summary table exists...')

    const { error: checkError } = await supabase
      .from('backtest_summary')
      .select('ticker', { count: 'exact' })
      .limit(1)

    if (!checkError) {
      console.log('✓ Table already exists!\n')
      console.log('MANUAL SETUP REQUIRED:')
      console.log('The backtest_summary table does not exist in Supabase.')
      console.log('\n📋 To create the table, follow these steps:')
      console.log('1. Go to Supabase Dashboard → SQL Editor')
      console.log('2. Click "New Query"')
      console.log('3. Copy and paste this SQL:')
      console.log('\n---SQL---')

      const sqlContent = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/create_backtest_summary.sql'), 'utf-8')
      console.log(sqlContent)
      console.log('\n---END SQL---')
      console.log('\n4. Click "Run"')
      console.log('\n5. Then run this script again to populate the table')
      return
    }

    // Table doesn't exist, provide manual instructions
    console.log('⚠️  Table does not exist yet.\n')

    console.log('MANUAL SETUP REQUIRED:')
    console.log('The backtest_summary table needs to be created in Supabase.')
    console.log('\n📋 Follow these steps:')
    console.log('1. Go to: https://app.supabase.com/project/[your-project]/sql/new')
    console.log('2. Copy and paste the SQL below')
    console.log('3. Click "Run"')
    console.log('4. Run this script again\n')

    console.log('---START SQL---')
    const sqlContent = fs.readFileSync(
      path.resolve(__dirname, '../supabase/migrations/create_backtest_summary.sql'),
      'utf-8'
    )
    console.log(sqlContent)
    console.log('---END SQL---\n')

  } catch (error) {
    console.error('Error:', error)
  }
}

main()
