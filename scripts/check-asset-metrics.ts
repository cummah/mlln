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
    .from('asset_macro_metrics')
    .select('ticker, dca_return_5y, dca_return_3y, dca_return_1y, macro_return_5y, macro_return_3y, macro_return_1y')
    .limit(5)

  console.log(`Total rows in asset_macro_metrics: ${count}`)
  console.log(`Sample data:`)
  console.log(JSON.stringify(data, null, 2))
  console.log(`Error: ${error?.message || 'none'}`)
}

check()
