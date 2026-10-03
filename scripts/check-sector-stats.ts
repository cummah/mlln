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

  // Check sector_stats
  const { data, error } = await supabase
    .from('sector_stats')
    .select('*')
    .limit(5)

  if (error) {
    console.error('Error fetching sector_stats:', error)
    return
  }

  console.log('Sample sector_stats rows:')
  console.log(JSON.stringify(data, null, 2))

  // Check one backtest_summary row to see if it has the data we need
  console.log('\n\nSample backtest_summary row:')
  const { data: btData } = await supabase
    .from('backtest_summary')
    .select('*')
    .limit(1)

  console.log(JSON.stringify(btData, null, 2))
}

main()
