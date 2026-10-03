import { createClient } from '@supabase/supabase-js'
import YahooFinance from 'yahoo-finance2'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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

async function checkColumn() {
  console.log('✓ Step 1: Checking if asset_type column exists...\n')

  const { data, error } = await supabase
    .from('assets')
    .select('asset_type')
    .limit(1)

  if (error && error.message.includes('does not exist')) {
    console.log('❌ Column asset_type does NOT exist yet.')
    console.log('\n📋 Please follow these steps:')
    console.log('1. Go to: https://app.supabase.com/project/gdzbgeoxvhwooudjkxao/sql')
    console.log('2. Click "New query"')
    console.log('3. Paste this SQL:')
    console.log('─'.repeat(60))
    console.log(`
ALTER TABLE assets ADD COLUMN IF NOT EXISTS asset_type TEXT;
CREATE INDEX IF NOT EXISTS idx_assets_asset_type ON assets(asset_type);
`)
    console.log('─'.repeat(60))
    console.log('4. Click "Run"')
    console.log('5. Run this script again: npx ts-node scripts/complete-asset-type-setup.ts')
    console.log('\n')
    return false
  }

  if (error) {
    console.error('❌ Error:', error)
    return false
  }

  console.log('✅ Column exists! Proceeding with classification...\n')
  return true
}

async function classifyAssets() {
  console.log('✓ Step 2: Fetching active assets...\n')

  const { data: assets, error } = await supabase
    .from('assets')
    .select('ticker, name')
    .eq('is_active', true)

  if (error) {
    console.error('❌ Error fetching assets:', error)
    return false
  }

  console.log(`Found ${assets.length} active assets\n`)
  console.log('✓ Step 3: Classifying assets...\n')

  const results: any[] = []
  const BATCH_SIZE = 20

  for (let i = 0; i < assets.length; i += BATCH_SIZE) {
    const batch = assets.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(assets.length / BATCH_SIZE)

    console.log(`Processing batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + BATCH_SIZE, assets.length)} of ${assets.length})...`)

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

        process.stdout.write('.')
      } catch (err) {
        results.push({
          ticker: asset.ticker,
          asset_type: 'stock',
          yahoo_type: 'ERROR'
        })
        process.stdout.write('E')
      }
    }))

    console.log('\n')
    // Tiny delay to avoid hitting Yahoo too hard
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  console.log(`\n✓ Step 4: Saving results...\n`)

  fs.writeFileSync(
    path.resolve(__dirname, 'asset-classification-results.json'),
    JSON.stringify(results, null, 2)
  )

  const counts = results.reduce((acc: any, r) => {
    acc[r.asset_type] = (acc[r.asset_type] || 0) + 1
    return acc
  }, {})

  console.log('Classification Summary:')
  console.log(JSON.stringify(counts, null, 2))
  console.log('')

  console.log('✓ Step 5: Updating Supabase...\n')

  const updateBatchSize = 100
  let updatedCount = 0
  let failedCount = 0

  for (let i = 0; i < results.length; i += updateBatchSize) {
    const updateBatch = results.slice(i, i + updateBatchSize)
    const { error: updateError } = await supabase
      .from('assets')
      .upsert(updateBatch.map(r => ({
        ticker: r.ticker,
        asset_type: r.asset_type
      })), { onConflict: 'ticker' })

    if (updateError) {
      console.error(`❌ Batch ${i / updateBatchSize + 1} failed:`, updateError.message)
      failedCount++
    } else {
      updatedCount += updateBatch.length
      console.log(`   Updated ${updatedCount}/${results.length} assets`)
    }
  }

  if (failedCount === 0) {
    console.log(`\n✅ All ${updatedCount} assets updated successfully!\n`)
    return true
  } else {
    console.log(`\n⚠️  ${failedCount} batches failed, but ${updatedCount} assets were updated\n`)
    return false
  }
}

async function verifyResults() {
  console.log('✓ Step 6: Verifying results...\n')

  // Check sample assets
  const { data: samples, error: sampleError } = await supabase
    .from('assets')
    .select('ticker, name, asset_type')
    .in('ticker', ['AAPL', 'SPY', '^VIX'])
    .limit(10)

  if (sampleError) {
    console.error('Error verifying:', sampleError)
    return false
  }

  console.log('Sample assets:')
  for (const asset of samples) {
    const expected =
      asset.ticker === 'AAPL' ? 'stock' :
      asset.ticker === 'SPY' ? 'etf' :
      asset.ticker === '^VIX' ? 'index' : '?'

    const status = asset.asset_type === expected ? '✅' : '⚠️'
    console.log(`  ${status} ${asset.ticker}: ${asset.asset_type} (expected: ${expected})`)
  }

  // Check counts
  const { data: counts, error: countError } = await supabase
    .rpc('count_by_asset_type')

  if (!countError && counts) {
    console.log('\nAsset type distribution:')
    console.log(JSON.stringify(counts, null, 2))
  } else {
    // Fallback: query manually
    console.log('\nFetching asset type counts...')
    const { data: allAssets } = await supabase
      .from('assets')
      .select('asset_type')
      .eq('is_active', true)
      .not('asset_type', 'is', null)

    const typeCounts = allAssets?.reduce((acc: any, a: any) => {
      acc[a.asset_type] = (acc[a.asset_type] || 0) + 1
      return acc
    }, {}) || {}

    console.log('Asset type distribution:')
    console.log(JSON.stringify(typeCounts, null, 2))
  }

  console.log('\n✅ Verification complete!\n')
  return true
}

async function main() {
  console.log('═'.repeat(60))
  console.log('   ASSET TYPE CLASSIFICATION - Complete Setup')
  console.log('═'.repeat(60))
  console.log('')

  const columnExists = await checkColumn()
  if (!columnExists) {
    console.log('❌ Setup incomplete. Please add the column first.')
    process.exit(1)
  }

  try {
    const classified = await classifyAssets()
    if (!classified) {
      console.log('❌ Classification failed')
      process.exit(1)
    }

    const verified = await verifyResults()

    console.log('═'.repeat(60))
    console.log('✅ ASSET TYPE SETUP COMPLETE!')
    console.log('═'.repeat(60))
    console.log('')
    console.log('You can now:')
    console.log('  • Filter assets by type in your application')
    console.log('  • Use asset_type in queries and API responses')
    console.log('  • Build UI features based on asset classification')
    console.log('')
  } catch (err) {
    console.error('❌ Error:', err)
    process.exit(1)
  }
}

main()
