const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const client = createClient(supabaseUrl, supabaseKey)

async function check() {
  // Check how many daily_signals records exist
  const { data: allSignals, error: e1 } = await client
    .from('daily_signals')
    .select('ticker', { count: 'exact' })

  console.log(`Total daily_signals records: ${allSignals?.length || 0}`)

  // Check assets table
  const { data: allAssets, error: e2 } = await client
    .from('assets')
    .select('ticker', { count: 'exact' })
    .eq('is_active', true)

  console.log(`Total active assets: ${allAssets?.length || 0}`)

  // Get a sample of signals for one ticker
  const { data: sample, error: e3 } = await client
    .from('daily_signals')
    .select('ticker, signals_1y')
    .eq('ticker', 'AAPL')
    .single()

  if (sample) {
    const signalCount = sample.signals_1y?.length || 0
    console.log(`\nSample (AAPL): ${signalCount} signals in signals_1y`)
    if (sample.signals_1y?.[0]) {
      console.log('First signal:', JSON.stringify(sample.signals_1y[0], null, 2))
    }
  } else {
    console.log('No AAPL signals found')
  }

  // Count total signals across all records
  const { data: allRecs } = await client
    .from('daily_signals')
    .select('signals_1y')

  let totalSignals = 0
  allRecs?.forEach(rec => {
    if (rec.signals_1y && Array.isArray(rec.signals_1y)) {
      totalSignals += rec.signals_1y.length
    }
  })

  console.log(`\nTotal signal objects across all records: ${totalSignals}`)
  console.log(`Average per ticker: ${(totalSignals / (allRecs?.length || 1)).toFixed(1)}`)
}

check().catch(console.error)
