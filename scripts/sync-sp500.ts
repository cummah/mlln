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

interface Asset {
  ticker: string
  name: string
  sector: string
}

// S&P 500 stocks - core holdings (sample for demo)
// In production, you would fetch the full list from slickcharts.com
const sp500Assets: Asset[] = [
  { ticker: 'AAPL', name: 'Apple Inc.', sector: 'Information Technology' },
  { ticker: 'MSFT', name: 'Microsoft Corporation', sector: 'Information Technology' },
  { ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Information Technology' },
  { ticker: 'GOOGL', name: 'Alphabet Inc. Class A', sector: 'Communication Services' },
  { ticker: 'GOOG', name: 'Alphabet Inc. Class C', sector: 'Communication Services' },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Discretionary' },
  { ticker: 'META', name: 'Meta Platforms Inc.', sector: 'Communication Services' },
  { ticker: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Discretionary' },
  { ticker: 'BRK.B', name: 'Berkshire Hathaway Inc. Class B', sector: 'Financials' },
  { ticker: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare' },
  { ticker: 'WMT', name: 'Walmart Inc.', sector: 'Consumer Staples' },
  { ticker: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financials' },
  { ticker: 'MO', name: 'Altria Group Inc.', sector: 'Consumer Staples' },
  { ticker: 'PG', name: 'Procter & Gamble Company', sector: 'Consumer Staples' },
  { ticker: 'XOM', name: 'Exxon Mobil Corporation', sector: 'Energy' },
  { ticker: 'KO', name: 'The Coca-Cola Company', sector: 'Consumer Staples' },
  { ticker: 'MA', name: 'Mastercard Incorporated', sector: 'Information Technology' },
  { ticker: 'V', name: 'Visa Inc.', sector: 'Information Technology' },
  { ticker: 'LLY', name: 'Eli Lilly and Company', sector: 'Healthcare' },
  { ticker: 'WFC', name: 'Wells Fargo & Company', sector: 'Financials' },
]

async function main() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    console.log('==========================================')
    console.log('    S&P 500 Ticker Synchronization')
    console.log('==========================================\n')

    // 1. Fetch existing tickers from assets table
    console.log('Fetching existing tickers from Supabase...')
    const { data: existingAssets, error: fetchError } = await supabase
      .from('assets')
      .select('ticker')

    if (fetchError || !existingAssets) {
      console.error('Error fetching existing assets:', fetchError)
      process.exit(1)
    }

    const existingTickers = new Set(existingAssets.map((a: { ticker: string }) => a.ticker))
    console.log(`Found ${existingTickers.size} existing tickers\n`)

    // 2. Identify new tickers
    const newAssets = sp500Assets.filter(asset => !existingTickers.has(asset.ticker))
    const newTickers = newAssets.map(a => a.ticker)

    console.log(`New S&P 500 tickers to add: ${newAssets.length}`)
    if (newTickers.length > 0) {
      console.log(`Tickers: ${newTickers.join(', ')}\n`)
    } else {
      console.log('All S&P 500 tickers already exist in database\n')
    }

    // 3. Upsert new assets with S&P 500 sector designation
    if (newAssets.length > 0) {
      console.log('Upserting new tickers...')
      const { error: upsertError } = await supabase
        .from('assets')
        .upsert(
          newAssets.map(asset => ({
            ticker: asset.ticker,
            name: asset.name,
            sector: 'S&P 500',
            is_active: true,
          })),
          { onConflict: 'ticker' }
        )

      if (upsertError) {
        console.error('Error upserting assets:', upsertError)
        process.exit(1)
      }

      console.log(`✓ Successfully added ${newAssets.length} new tickers\n`)
    }

    // 4. Run backfill for new tickers only
    if (newTickers.length > 0) {
      console.log('Running price backfill for new tickers...')
      console.log(`Executing: npx ts-node backfill-prices.ts --tickers=${newTickers.join(',')}\n`)

      try {
        execSync(
          `npx ts-node backfill-prices.ts --tickers=${newTickers.join(',')}`,
          { stdio: 'inherit', cwd: path.resolve(__dirname, '..') }
        )
      } catch (error) {
        console.error('Error running backfill script:', error)
        process.exit(1)
      }
    } else {
      console.log('No new tickers to backfill\n')
    }

    // 5. Print summary
    console.log('==========================================')
    console.log('         SYNC COMPLETED')
    console.log('==========================================')
    console.log(`New tickers added:     ${newAssets.length}`)
    console.log(`Total S&P 500 tickers: ${sp500Assets.length}`)
    console.log(`Database total:        ${existingTickers.size + newAssets.length}`)
    console.log('==========================================\n')
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

main()
