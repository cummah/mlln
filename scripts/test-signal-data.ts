import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env.local
const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function testSignalAPI() {
  const ticker = 'AAPL'
  const window = { display: '5y', size: 1310 }

  // Fetch all price data (same as signal API)
  let allPrices: any[] = []
  let page = 0
  const pageSize = 1000

  while (true) {
    const start = page * pageSize
    const end = start + pageSize - 1

    const { data: pageData } = await supabase
      .from('daily_prices')
      .select('date, open, high, low, close, volume')
      .eq('ticker', ticker)
      .order('date', { ascending: true })
      .range(start, end)

    if (!pageData || pageData.length === 0) break
    allPrices = allPrices.concat(pageData)
    if (pageData.length < pageSize) break
    page++
  }

  console.log(`Total bars fetched: ${allPrices.length}`)
  console.log(`First date: ${allPrices[0]?.date}`)
  console.log(`Last date: ${allPrices[allPrices.length - 1]?.date}`)

  // Slice to window size (same as signal API)
  const sliceStart = Math.max(0, allPrices.length - window.size)
  const windowBars = allPrices.slice(sliceStart)

  console.log(`\nWindow ${window.display}:`)
  console.log(`  Slice start: ${sliceStart}`)
  console.log(`  Sliced to: ${windowBars.length} bars`)
  console.log(`  First date: ${windowBars[0]?.date}`)
  console.log(`  Last date: ${windowBars[windowBars.length - 1]?.date}`)
}

testSignalAPI().catch(console.error)
