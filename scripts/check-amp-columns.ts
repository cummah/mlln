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
  const { data } = await supabase
    .from('backtest_summary')
    .select('ticker, std_return_5y, std_return_3y, std_return_1y, enh_return_5y, enh_return_3y, enh_return_1y')
    .eq('ticker', 'AMP')
    .single()

  console.log('AMP Backtest Summary:')
  console.log(JSON.stringify(data, null, 2))
}

check()
