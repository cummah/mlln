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
    .select('*')
    .eq('ticker', 'AAPL')
    .single()

  if (data) {
    console.log('All AAPL backtest columns:')
    Object.keys(data).sort().forEach(k => {
      console.log(`  ${k}`)
    })
  } else {
    console.log('No AAPL data found')
  }
}

check()
