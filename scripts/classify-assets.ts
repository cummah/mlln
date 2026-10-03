import { createClient } from '@supabase/supabase-js'
import YahooFinance from 'yahoo-finance2'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim().replace(/^["'](.*)["']$/, '$1')
      process.env[key] = value
    }
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const yahooFinance = new YahooFinance()

async function main() {
  console.log('Fetching active assets from Supabase...')
  const { data: assets, error } = await supabase
    .from('assets')
    .select('ticker, name')
    .eq('is_active', true)

  if (error) {
    console.error('Error fetching assets:', error)
    return
  }

  console.log(`Found ${assets.length} active assets. Classifying...`)

  const results: any[] = []
  const BATCH_SIZE = 20
  
  for (let i = 0; i < assets.length; i += BATCH_SIZE) {
    const batch = assets.slice(i, i + BATCH_SIZE)
    console.log(`Processing batch ${i / BATCH_SIZE + 1}/${Math.ceil(assets.length / BATCH_SIZE)}...`)
    
    await Promise.all(batch.map(async (asset) => {
      try {
        const quote = await yahooFinance.quote(asset.ticker) as any
        let type = 'stock'
        if (quote.quoteType === 'ETF') type = 'etf'
        else if (quote.quoteType === 'INDEX') type = 'index'
        else if (quote.quoteType === 'MUTUALFUND') type = 'etf'
        else if (quote.quoteType === 'EQUITY') type = 'stock'
        
        results.push({
          ticker: asset.ticker,
          asset_type: type,
          yahoo_type: quote.quoteType
        })
      } catch (err) {
        console.error(`Error classifying ${asset.ticker}:`, (err as any).message)
        // Default to stock if error, but maybe better to mark as unknown
        results.push({
          ticker: asset.ticker,
          asset_type: 'stock',
          yahoo_type: 'ERROR'
        })
      }
    }))
    
    // Tiny delay to avoid hitting Yahoo too hard
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  console.log(`Classification complete. Saving results to scripts/asset-classification-results.json...`)
  fs.writeFileSync(
    path.resolve(__dirname, 'asset-classification-results.json'),
    JSON.stringify(results, null, 2)
  )

  console.log('\nSummary:')
  const counts = results.reduce((acc: any, r) => {
    acc[r.asset_type] = (acc[r.asset_type] || 0) + 1
    return acc
  }, {})
  console.log(counts)
  
  // Try to update Supabase if the column exists
  console.log('\nAttempting to update Supabase...')
  const updateBatchSize = 100
  let updatedCount = 0
  
  for (let i = 0; i < results.length; i += updateBatchSize) {
    const updateBatch = results.slice(i, i + updateBatchSize)
    const { error: updateError } = await supabase
      .from('assets')
      .upsert(updateBatch.map(r => ({
        ticker: r.ticker,
        asset_type: r.asset_type
      })), { onConflict: 'ticker' })
      
    if (updateError) {
      console.error(`Batch ${i / updateBatchSize + 1} failed:`, updateError.message)
      if (updateError.message.includes('column "asset_type" of relation "assets" does not exist')) {
        console.log('Stopping updates as column does not exist. Please run the migration first.')
        break
      }
    } else {
      updatedCount += updateBatch.length
      console.log(`Updated ${updatedCount}/${results.length} assets...`)
    }
  }
}

main()
