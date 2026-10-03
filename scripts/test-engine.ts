import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { runTVEnhancedDCA } from '../lib/dcaEngine'
import type { PriceBar } from '../lib/dcaEngine'

// Load .env.local so Supabase keys are available
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

  // 1. Fetch SPY bars
  const PAGE = 1000
  const allRows: PriceBar[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('daily_prices')
      .select('date, open, high, low, close, volume')
      .eq('ticker', 'SPY')
      .order('date', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) {
      console.error('Supabase error (SPY):', error)
      process.exit(1)
    }
    if (!data || data.length === 0) break
    allRows.push(...(data as PriceBar[]))
    if (data.length < PAGE) break
  }

  if (allRows.length === 0) {
    console.error('No SPY rows found in daily_prices')
    process.exit(1)
  }

  // 2. Fetch VIX bars
  const vixMap = new Map<string, number>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('daily_prices')
      .select('date, close')
      .eq('ticker', '^VIX')
      .order('date', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) {
      console.error('Supabase error (VIX):', error)
      process.exit(1)
    }
    if (!data || data.length === 0) break
    for (const row of (data as any[])) {
      vixMap.set(row.date, row.close)
    }
    if (data.length < PAGE) break
  }

  // 3. Merge VIX into SPY bars
  for (const bar of allRows) {
    bar.vix = vixMap.get(bar.date)
  }

  console.error(`Loaded ${allRows.length} bars for SPY. VIX data available for ${vixMap.size} dates.`)

  const fromDate = process.argv[2]
  if (fromDate) console.error(`Backtest from: ${fromDate}`)

  const resWeekly = runTVEnhancedDCA(allRows, { rsiLength: 7, frequency: 'weekly' })
  const resMonthly = runTVEnhancedDCA(allRows, { rsiLength: 14, frequency: 'monthly' })

  function printStats(label: string, stats: any) {
    console.log(`\n--- ${label} ---`)
    console.log(`  Invested: $${stats.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2 })}`)
    console.log(`  Profit %: ${stats.netProfitPct.toFixed(2)}%`)
    console.log(`  Shares:   ${stats.totalShares.toFixed(4)}`)
  }

  console.log('\n==========================================')
  console.log('         DCA BACKTEST SUMMARY')
  console.log('==========================================')
  console.log(`\n[DATE RANGE: ${resWeekly.backtest.dateRange.from} to ${resWeekly.backtest.dateRange.to}]`)
  console.log(`[TOTAL BARS USED FOR CALCULATION: ${allRows.length}]`)

  printStats('1. WEEKLY STANDARD DCA', resWeekly.backtest.std)
  printStats('2. WEEKLY ENHANCED DCA (RSI-7)', resWeekly.backtest.enh)
  printStats('3. MONTHLY STANDARD DCA', resMonthly.backtest.std)
  printStats('4. MONTHLY ENHANCED DCA (RSI-14)', resMonthly.backtest.enh)

  console.log('\n==========================================')
  console.log('         LAST 10 DCA DAYS DEBUG (RSI-7)')
  console.log('==========================================')
  if (resWeekly.backtest.debugDCADays && resWeekly.backtest.debugDCADays.length > 0) {
    const last10 = resWeekly.backtest.debugDCADays.slice(-10)
    console.log(JSON.stringify(last10, null, 2))
  }
}



main().catch(err => {
  console.error(err)
  process.exit(1)
})


