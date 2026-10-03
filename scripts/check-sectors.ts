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

  // Get unique sectors
  const { data, error } = await supabase
    .from('assets')
    .select('sector')

  if (error) {
    console.error('Error:', error)
    process.exit(1)
  }

  const sectors = new Map<string, number>()
  for (const asset of data as { sector: string }[]) {
    sectors.set(asset.sector, (sectors.get(asset.sector) || 0) + 1)
  }

  console.log('Sectors in assets table:')
  Array.from(sectors.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([sector, count]) => {
      console.log(`  ${sector}: ${count} tickers`)
    })

  // Check for S&P 500 specifically
  const { count: sp500Count } = await supabase
    .from('assets')
    .select('*', { count: 'exact', head: true })
    .eq('sector', 'S&P 500')

  console.log(`\nS&P 500 sector tickers: ${sp500Count || 0}`)
}

main()
