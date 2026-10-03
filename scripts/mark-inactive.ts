import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

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

  try {
    console.log('Getting list of tickers without price data...')

    // Get all assets
    const { data: allAssets, error: allError } = await supabase
      .from('assets')
      .select('ticker')

    if (allError) {
      console.error('Error fetching all assets:', allError)
      process.exit(1)
    }

    // Fetch all distinct tickers from daily_prices
    console.log('Fetching tickers with price data...')
    let tickersWithData: Set<string> = new Set()
    const PAGE_SIZE = 1000

    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('daily_prices')
        .select('ticker')
        .range(offset, offset + PAGE_SIZE - 1)

      if (error) {
        console.error('Error fetching daily_prices:', error)
        process.exit(1)
      }

      if (!data || data.length === 0) break

      for (const row of data) {
        tickersWithData.add((row as any).ticker)
      }
    }

    console.log(`Found ${tickersWithData.size} unique tickers with price data`)

    const allTickers = (allAssets || []).map(a => a.ticker)
    const tickersToDeactivate = allTickers.filter(t => !tickersWithData.has(t))

    console.log(
      `Found ${tickersToDeactivate.length} tickers without price data. Marking as inactive...\n`
    )

    // Update assets to inactive
    if (tickersToDeactivate.length > 0) {
      const { error: updateError } = await supabase
        .from('assets')
        .update({ is_active: false })
        .in('ticker', tickersToDeactivate)

      if (updateError) {
        console.error('Error updating assets:', updateError)
        process.exit(1)
      }

      console.log(`✓ Marked ${tickersToDeactivate.length} tickers as inactive`)
    }

    // Query final counts
    const { data: activeAssets, count: activeCount, error: activeError } = await supabase
      .from('assets')
      .select('ticker', { count: 'exact' })
      .eq('is_active', true)

    if (activeError) {
      console.error('Error querying active assets:', activeError)
      process.exit(1)
    }

    const { data: totalAssets, count: totalCount, error: totalError } = await supabase
      .from('assets')
      .select('ticker', { count: 'exact' })

    if (totalError) {
      console.error('Error querying total assets:', totalError)
      process.exit(1)
    }

    const finalActiveCount = activeCount || 0
    const finalTotalCount = totalCount || 0
    const inactiveCount = finalTotalCount - finalActiveCount

    console.log('\n==========================================')
    console.log('         ASSETS STATUS SUMMARY')
    console.log('==========================================')
    console.log(`Total assets:              ${finalTotalCount}`)
    console.log(`Active assets:             ${finalActiveCount}`)
    console.log(`Inactive assets:           ${inactiveCount}`)
    console.log(`Active percentage:         ${((finalActiveCount / finalTotalCount) * 100).toFixed(1)}%`)
    console.log('==========================================\n')
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

main()
