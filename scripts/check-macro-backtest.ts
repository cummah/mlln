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
  const { data, count, error } = await supabase
    .from('asset_backtest_macro')
    .select('ticker, macro_return_5y, macro_return_3y, macro_return_1y', { count: 'exact' })
    .limit(5)

  console.log(`Total rows in asset_backtest_macro: ${count}`)
  console.log(`Sample data:`)
  console.log(JSON.stringify(data, null, 2))
  console.log(`Error: ${error?.message || 'none'}`)
}

check()
