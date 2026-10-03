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
  console.log('=== Macro Regime History Structure ===\n')

  const { data } = await supabase
    .from('macro_regime_history')
    .select('*')
    .limit(5)

  if (data && data.length > 0) {
    console.log('Sample rows:')
    data.forEach((row: any, i: number) => {
      console.log(`\nRow ${i + 1}:`)
      Object.entries(row).forEach(([key, value]: [string, any]) => {
        console.log(`  ${key}: ${value}`)
      })
    })
  }

  // Check date range
  const { data: dates } = await supabase
    .from('macro_regime_history')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false })
    .limit(1)

  const { data: oldDates } = await supabase
    .from('macro_regime_history')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: true })
    .limit(1)

  console.log('\n\nDate range:')
  console.log('  Oldest:', oldDates?.[0]?.snapshot_date)
  console.log('  Newest:', dates?.[0]?.snapshot_date)
}

check()
