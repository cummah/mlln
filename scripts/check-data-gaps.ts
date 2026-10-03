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

  // Get all assets
  const { data: assets } = await supabase
    .from('assets')
    .select('ticker')
    .eq('is_active', true)
    .order('ticker')

  if (!assets) return

  const dateCounts = new Map<string, number>()

  console.log('Checking latest date for each asset...')
  for (const asset of assets) {
    const { data } = await supabase
      .from('daily_prices')
      .select('date')
      .eq('ticker', asset.ticker)
      .order('date', { ascending: false })
      .limit(1)

    const latestDate = data?.[0]?.date
    if (latestDate) {
      const count = (dateCounts.get(latestDate) ?? 0) + 1
      dateCounts.set(latestDate, count)
    }
  }

  console.log('\nData date distribution:')
  const sorted = Array.from(dateCounts.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  for (const [date, count] of sorted) {
    console.log(`  ${date}: ${count} tickers`)
  }

  // Find oldest date
  const oldestDate = sorted[sorted.length - 1]?.[0]
  console.log(`\nOldest data: ${oldestDate}`)
  console.log(`Most recent data: ${sorted[0]?.[0]}`)
}

main().catch(console.error)
