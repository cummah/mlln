import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { runTVEnhancedDCA, PriceBar } from '../lib/dcaEngine'

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

  console.log('Testing dateRange calculation in dcaEngine\n')

  // Fetch last 300 bars for SPY
  const { data: prices } = await supabase
    .from('daily_prices')
    .select('date, open, high, low, close, volume')
    .eq('ticker', 'SPY')
    .order('date', { ascending: false })
    .limit(300)

  if (!prices || prices.length === 0) {
    console.error('No price data found')
    process.exit(1)
  }

  // Reverse to ascending order
  const allPrices = prices.reverse()

  console.log(`Fetched ${allPrices.length} bars`)
  console.log(`Data range: ${allPrices[0].date} to ${allPrices[allPrices.length - 1].date}\n`)

  // Convert to PriceBar format
  const bars: PriceBar[] = allPrices.map(p => ({
    date: p.date,
    open: Number(p.open),
    high: Number(p.high),
    low: Number(p.low),
    close: Number(p.close),
    volume: Number(p.volume),
  }))

  // Test with different window sizes
  const windows = [
    { name: '1Y (252 days)', days: 252 },
    { name: '3Y (756 days)', days: 756 },
    { name: '5Y (1260 days)', days: 1260 },
  ]

  console.log('========================================')
  console.log('    Testing dateRange Calculation')
  console.log('========================================\n')

  for (const window of windows) {
    console.log(`\n--- ${window.name} ---`)

    // Calculate fromDate
    const lastDate = new Date(bars[bars.length - 1].date)
    const fromDate = new Date(lastDate)
    fromDate.setDate(fromDate.getDate() - window.days)
    const fromDateStr = fromDate.toISOString().split('T')[0]

    console.log(`Last bar: ${bars[bars.length - 1].date}`)
    console.log(`Calculated fromDate: ${fromDateStr}`)

    // Test with ALL 300 bars
    try {
      const result = runTVEnhancedDCA(bars, {
        rsiLength: 7,
        frequency: 'weekly',
      })

      console.log(`\nActual dateRange:`)
      console.log(`  from: ${result.backtest.dateRange.from}`)
      console.log(`  to:   ${result.backtest.dateRange.to}`)

      // Check if it makes sense
      const rangeLength = (new Date(result.backtest.dateRange.to).getTime() - new Date(result.backtest.dateRange.from).getTime()) / (1000 * 60 * 60 * 24)
      const totalWeeks = Math.round(rangeLength / 7)
      console.log(`  Range: ${rangeLength.toFixed(0)} days`)
      console.log(`  Total weeks in backtest: ${totalWeeks}`)
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  console.log('\n========================================')
  console.log('Expected: dateRange should match the window duration,')
  console.log('not go back to 2015. If from: shows dates older than')
  console.log('expected, the dateRange calculation needs fixing.')
  console.log('========================================\n')
}

main()
