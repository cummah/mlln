const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const client = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data: allActive } = await client
    .from('assets')
    .select('ticker', { count: 'exact' })
    .eq('is_active', true)

  const { data: inactive } = await client
    .from('assets')
    .select('ticker', { count: 'exact' })
    .eq('is_active', false)

  console.log(`Active assets: ${allActive?.length || 0}`)
  console.log(`Inactive assets: ${inactive?.length || 0}`)

  // Check which assets don't have daily_signals
  const { data: withRecords } = await client
    .from('daily_signals')
    .select('ticker')

  const recordTickers = new Set(withRecords?.map(r => r.ticker) || [])

  const { data: activeAssets } = await client
    .from('assets')
    .select('ticker')
    .eq('is_active', true)

  const missing = activeAssets?.filter(a => !recordTickers.has(a.ticker)) || []
  console.log(`\nActive assets missing daily_signals records: ${missing.length}`)
  if (missing.length <= 20) {
    console.log(`Missing tickers: ${missing.map(a => a.ticker).join(', ')}`)
  }
}

test().catch(console.error)
