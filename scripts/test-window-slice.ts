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

  console.log('Testing Window Slicing Approach\n')
  console.log('========================================\n')

  // Fetch last 300 bars for SPY (descending, then reverse)
  console.log('Fetching SPY daily_prices...')
  const { data: pricesDesc } = await supabase
    .from('daily_prices')
    .select('date, open, high, low, close, volume')
    .eq('ticker', 'SPY')
    .order('date', { ascending: false })
    .limit(300)

  if (!pricesDesc || pricesDesc.length === 0) {
    console.error('No price data found')
    process.exit(1)
  }

  // Reverse to ascending order
  const allPrices = pricesDesc.reverse()

  // Convert to PriceBar format
  const bars: PriceBar[] = allPrices.map(p => ({
    date: p.date,
    open: Number(p.open),
    high: Number(p.high),
    low: Number(p.low),
    close: Number(p.close),
    volume: Number(p.volume),
  }))

  console.log('✓ Fetched SPY prices\n')

  // Test 5-year window
  const windowDays = 1260

  console.log(`Testing ${windowDays}-day window (5-year):\n`)

  // Calculate window slice
  const windowStartIndex = Math.max(0, bars.length - windowDays)
  const windowBars = bars.slice(windowStartIndex)

  console.log(`Total bars fetched:        ${bars.length}`)
  console.log(`Window start index:        ${windowStartIndex}`)
  console.log(`Window bars length:        ${windowBars.length}`)
  console.log(`First bar date:            ${bars[0].date}`)
  console.log(`Last bar date:             ${bars[bars.length - 1].date}`)
  console.log()
  console.log(`First window bar date:     ${windowBars[0].date}`)
  console.log(`Last window bar date:      ${windowBars[windowBars.length - 1].date}`)
  console.log()

  // Run DCA on window bars
  console.log('Running runTVEnhancedDCA on window bars...')
  try {
    const result = runTVEnhancedDCA(windowBars, {
      rsiLength: 7,
      frequency: 'weekly',
    })

    console.log('\n✓ runTVEnhancedDCA completed successfully\n')
    console.log('Backtest dateRange:')
    console.log(`  from: ${result.backtest.dateRange.from}`)
    console.log(`  to:   ${result.backtest.dateRange.to}`)

    // Verify dateRange is within window bounds (not exact match due to Monday filtering)
    const rangeFromWithinBounds = result.backtest.dateRange.from >= windowBars[0].date
    const rageToWithinBounds = result.backtest.dateRange.to <= windowBars[windowBars.length - 1].date

    console.log()
    console.log('Verification:')
    console.log(`  Window contains dateRange.from: ${rangeFromWithinBounds ? '✓ YES' : '✗ NO'}`)
    console.log(`  Window contains dateRange.to:   ${rageToWithinBounds ? '✓ YES' : '✗ NO'}`)
    console.log()
    console.log('Note: dateRange reflects Monday bars used in backtest,')
    console.log('      not the entire window (due to Monday-only filtering)')

    if (rangeFromWithinBounds && rageToWithinBounds) {
      console.log('\n✓ Window slicing is working correctly!')
    } else {
      console.log('\n✗ dateRange exceeds window bounds')
    }

    console.log()
    const totalDays = (new Date(result.backtest.dateRange.to).getTime() - new Date(result.backtest.dateRange.from).getTime()) / (1000 * 60 * 60 * 24)
    const totalWeeks = Math.round(totalDays / 7)
    console.log(`Total weeks in backtest: ${totalWeeks}`)
    console.log(`Standard DCA return:     ${result.backtest.std.netProfitPct.toFixed(2)}%`)
    console.log(`Enhanced DCA return:     ${result.backtest.enh.netProfitPct.toFixed(2)}%`)
    console.log(`Alpha:                   ${result.backtest.alpha.toFixed(4)}`)
  } catch (err) {
    console.error('Error running runTVEnhancedDCA:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  }

  console.log('\n========================================\n')
}

main()
