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
  console.log('Checking if backtest_summary_macro table exists...\n')

  try {
    const { data, error } = await supabase
      .from('backtest_summary_macro')
      .select('count', { count: 'exact', head: true })

    if (error) {
      console.log('❌ ERROR: Table does not exist or cannot be queried')
      console.log('Error:', error.message)
      console.log('\nYou need to:')
      console.log('1. Go to Supabase dashboard')
      console.log('2. Open the SQL editor')
      console.log('3. Copy the contents of: supabase/migrations/20260530_create_backtest_summary_macro.sql')
      console.log('4. Paste and execute in Supabase')
    } else {
      console.log('✓ Table exists and is queryable')
      console.log('Row count:', data?.length || 'unknown')
    }
  } catch (err: any) {
    console.log('❌ ERROR:', err.message)
  }
}

check()
