import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { runTVEnhancedDCA, PriceBar } from '@/lib/dcaEngine'

const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

async function main() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    console.log('Testing with single ticker: SPY')

    // Fetch first ticker
    const { data: assets } = await supabase
      .from('assets')
      .select('ticker, name, sector')
      .eq('is_active', true)
      .limit(1)

    if (!assets || assets.length === 0) {
      console.error('No assets found')
      return
    }

    const asset = assets[0]
    console.log(`\nFetching price data for ${asset.ticker}...`)

    // Fetch price data for this ticker
    let allPrices: any[] = []
    let page = 0
    const pageSize = 1000

    const startTime = Date.now()
    while (true) {
      console.log(`  Fetching page ${page}...`)
      const { data: pageData, error: pageError } = await supabase
        .from('daily_prices')
        .select('date, open, high, low, close, volume')
        .eq('ticker', asset.ticker)
        .order('date', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (pageError) {
        console.error(`  Error: ${pageError.message}`)
        break
      }
      if (!pageData || pageData.length === 0) {
        console.log(`  No more data`)
        break
      }

      console.log(`  Got ${pageData.length} records`)
      allPrices = allPrices.concat(pageData)
      if (pageData.length < pageSize) break
      page++
    }
    const fetchTime = Date.now() - startTime
    console.log(`\nFetched ${allPrices.length} price records in ${fetchTime}ms`)

    if (allPrices.length < 1500) {
      console.error('Not enough data (need 1500+)')
      return
    }

    // Convert to PriceBar
    const bars: PriceBar[] = allPrices.map(p => ({
      date: p.date,
      open: Number(p.open),
      high: Number(p.high),
      low: Number(p.low),
      close: Number(p.close),
      volume: Number(p.volume),
    }))

    console.log(`\nRunning backtests...`)
    const windows = [
      { label: '1y', days: 365 },
      { label: '3y', days: 1095 },
      { label: '5y', days: 1825 },
    ]

    for (const window of windows) {
      const windowStart = Date.now()
      console.log(`  ${window.label}...`)
      const windowBars = bars.slice(Math.max(0, bars.length - window.days))

      if (windowBars.length < 200) {
        console.log(`    Not enough data`)
        continue
      }

      const result = runTVEnhancedDCA(windowBars, { rsiLength: 7, baseAmount: 100, frequency: 'weekly' })
      const windowTime = Date.now() - windowStart
      console.log(`    std_return: ${result.backtest.std.netProfitPct}% (${windowTime}ms)`)
    }

    console.log('\n✓ Test complete')
  } catch (error) {
    console.error('Fatal error:', error)
  }
}

main()
