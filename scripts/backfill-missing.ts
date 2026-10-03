import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'child_process'

// Load .env.local so Supabase keys are available
const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

interface TickerStatus {
  ticker: string
  priceCount: number
  needsBackfill: boolean
}

async function main() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    console.log('==========================================')
    console.log('   Backfill Missing Price Data (S&P 500)')
    console.log('==========================================\n')

    // 1. Fetch all active tickers
    console.log('Fetching all active tickers from assets table...')
    const { data: allAssets, error: assetsError } = await supabase
      .from('assets')
      .select('ticker')
      .eq('is_active', true)

    if (assetsError || !allAssets) {
      console.error('Error fetching assets:', assetsError)
      process.exit(1)
    }

    const allTickers = allAssets.map(a => a.ticker.trim())
    console.log(`Found ${allTickers.length} active tickers\n`)

    // 2. Check price data for each ticker (batched parallel HEAD queries)
    console.log('Checking price data completeness...')
    const tickerStatuses: TickerStatus[] = []
    const countMap = new Map<string, number>()
    const BATCH_SIZE = 50

    for (let i = 0; i < allTickers.length; i += BATCH_SIZE) {
      const batch = allTickers.slice(i, i + BATCH_SIZE)
      const promises = batch.map(async (ticker) => {
        const { count, error } = await supabase
          .from('daily_prices')
          .select('*', { count: 'exact', head: true })
          .eq('ticker', ticker)

        if (error) {
          console.error(`  Error checking counts for ${ticker}:`, error.message)
          countMap.set(ticker, 0)
        } else {
          countMap.set(ticker, count || 0)
        }
      })
      await Promise.all(promises)
      if ((i + BATCH_SIZE) % 100 === 0 || i + BATCH_SIZE >= allTickers.length) {
        console.log(`  Checked ${Math.min(i + BATCH_SIZE, allTickers.length)}/${allTickers.length} tickers...`)
      }
    }
    console.log('')

    // Assign status for each ticker
    for (const ticker of allTickers) {
      const priceCount = countMap.get(ticker) ?? 0
      const needsBackfill = priceCount < 200

      tickerStatuses.push({
        ticker,
        priceCount,
        needsBackfill,
      })
    }

    // 3. Identify tickers needing backfill
    const missingTickers = tickerStatuses.filter(t => t.needsBackfill)
    const completeTickers = tickerStatuses.filter(t => !t.needsBackfill)

    console.log('==========================================')
    console.log('         BACKFILL STATUS')
    console.log('==========================================')
    console.log(`Total active tickers:      ${allTickers.length}`)
    console.log(`Complete (>=200 rows):     ${completeTickers.length}`)
    console.log(`Missing (<200 rows):       ${missingTickers.length}`)
    console.log('')

    if (missingTickers.length === 0) {
      console.log('✓ All S&P 500 tickers have complete price data!')
      console.log('==========================================\n')
      process.exit(0)
    }

    // Show tickers with lowest row counts
    const lowestCounts = missingTickers
      .sort((a, b) => a.priceCount - b.priceCount)
      .slice(0, 10)

    console.log('Tickers with lowest price row counts:')
    for (const ticker of lowestCounts) {
      console.log(`  ${ticker.ticker}: ${ticker.priceCount} rows`)
    }
    console.log('')

    // 4. Run backfill for missing tickers
    const tickersToBackfill = missingTickers.map(t => t.ticker)
    console.log(`Running backfill for ${tickersToBackfill.length} tickers...`)
    console.log(`Executing: npx ts-node scripts/backfill-prices.ts --tickers=${tickersToBackfill.join(',')}\n`)

    try {
      execSync(
        `npx ts-node --project tsconfig.scripts.json scripts/backfill-prices.ts --tickers=${tickersToBackfill.join(',')}`,
        { stdio: 'inherit', cwd: path.resolve(__dirname, '..') }
      )
    } catch (error) {
      console.error('\nError running backfill script:', error)
      // Continue to show summary even if backfill had issues
    }

    // 5. Check results after backfill
    console.log('\nRe-checking price data after backfill...')
    const resultsAfter: TickerStatus[] = []
    let successCount = 0
    let failureCount = 0
    let totalRowsAdded = 0

    for (const ticker of tickersToBackfill) {
      const { count, error } = await supabase
        .from('daily_prices')
        .select('*', { count: 'exact', head: true })
        .eq('ticker', ticker)

      const priceCountBefore = tickerStatuses.find(t => t.ticker === ticker)?.priceCount || 0
      const priceCountAfter = error ? 0 : (count || 0)
      const rowsAdded = priceCountAfter - priceCountBefore

      resultsAfter.push({
        ticker,
        priceCount: priceCountAfter,
        needsBackfill: priceCountAfter < 200,
      })

      if (priceCountAfter >= 200) {
        successCount++
        totalRowsAdded += rowsAdded
      } else if (priceCountAfter > priceCountBefore) {
        totalRowsAdded += rowsAdded
      } else {
        failureCount++
      }
    }

    // 6. Print final summary
    const stillMissing = resultsAfter.filter(t => t.needsBackfill).length

    console.log('\n==========================================')
    console.log('      BACKFILL RESULTS SUMMARY')
    console.log('==========================================')
    console.log(`Tickers targeted for backfill: ${tickersToBackfill.length}`)
    console.log(`Successfully filled (>=200):   ${successCount}`)
    console.log(`Partially filled:              ${tickersToBackfill.length - successCount - failureCount}`)
    console.log(`Failed to fill:                ${failureCount}`)
    console.log(`Total new rows added:          ${totalRowsAdded}`)
    console.log('')
    console.log(`Remaining incomplete:          ${stillMissing}`)
    console.log('==========================================\n')

    if (stillMissing > 0) {
      console.log('Tickers still missing data:')
      for (const ticker of resultsAfter.filter(t => t.needsBackfill)) {
        console.log(`  ${ticker.ticker}: ${ticker.priceCount} rows`)
      }
      console.log('')
    }
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

main()
