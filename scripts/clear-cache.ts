import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env.local
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

  console.log('Clearing backtest_windows_cache table...')
  const { error } = await supabase
    .from('backtest_windows_cache')
    .delete()
    .neq('ticker', '') // Delete all rows

  if (error) {
    console.error('Error clearing cache:', error)
    process.exit(1)
  }

  console.log('✓ Cache cleared successfully\n')
}

main()
