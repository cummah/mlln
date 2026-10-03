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

  // Get table schema from information_schema
  const { data, error } = await supabase
    .rpc('execute_sql', {
      sql: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'backtest_summary' ORDER BY ordinal_position"
    })

  if (error) {
    console.log('RPC not available, trying direct query...')
    // Fallback: just try to select and see what columns we get
    const { data: sample } = await supabase
      .from('backtest_summary')
      .select('*')
      .limit(1)
    
    if (sample && sample.length > 0) {
      console.log('Backtest_summary columns:', Object.keys(sample[0]))
    } else {
      console.log('Backtest_summary table exists but is empty')
    }
    return
  }

  console.log('Backtest_summary columns:')
  if (data) {
    data.forEach((row: any) => {
      console.log(`  ${row.column_name} (${row.data_type})`)
    })
  }
}

main()
