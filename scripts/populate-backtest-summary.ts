#!/usr/bin/env npx ts-node

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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  console.log('\n' + '='.repeat(70))
  console.log('CHECKING IF TABLE EXISTS')
  console.log('='.repeat(70) + '\n')

  // Check if table exists
  const { error: checkError } = await supabase
    .from('backtest_summary')
    .select('ticker', { count: 'exact' })
    .limit(1)

  if (checkError && checkError.message.includes('Could not find the table')) {
    console.log('❌ ERROR: backtest_summary table does not exist!\n')
    console.log('Please create the table first:')
    console.log('  Read: BACKTEST_SETUP_INSTRUCTIONS.md')
    console.log('  Run the SQL in Supabase SQL Editor')
    console.log('  Then run this script again\n')
    process.exit(1)
  }

  console.log('✅ Table exists!\n')
  console.log('Now running full backtest computation...')
  console.log('This will compute 694 assets and populate the table.')
  console.log('Time: ~6-7 minutes\n')
  console.log('='.repeat(70) + '\n')

  // Now run the compute script
  const { spawn } = require('child_process')
  const child = spawn('npx', ['tsx', 'scripts/compute-backtest-summary.ts'], {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  })

  child.on('close', (code: number) => {
    if (code === 0) {
      console.log('\n' + '='.repeat(70))
      console.log('✅ POPULATION COMPLETE!')
      console.log('='.repeat(70))
      console.log('\nYour backtest_summary table is now populated with 694 assets.')
      console.log('All SEO components will use real backtest data.\n')
      console.log('Next: Test the pages')
      console.log('  npm run dev')
      console.log('  Visit: http://localhost:3000/dashboard/SPY\n')
    } else {
      console.log('\n❌ Population failed with code:', code)
      process.exit(code)
    }
  })
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
