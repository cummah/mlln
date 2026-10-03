const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const client = createClient(supabaseUrl, supabaseKey)

async function getBacktestSignals(ticker) {
  const { data: dataRaw, error } = await client
    .from('daily_signals')
    .select('signals_1y, current_signal')
    .eq('ticker', ticker.toUpperCase())
    .single()

  return { error, hasData: !!dataRaw }
}

async function test() {
  const { data: assets } = await client
    .from('assets')
    .select('ticker')
    .eq('is_active', true)
    .order('ticker')
    .limit(100)

  let errors = 0
  let noData = 0
  let success = 0

  for (const asset of assets) {
    const result = await getBacktestSignals(asset.ticker)
    if (result.error) {
      errors++
      console.log(`${asset.ticker}: ERROR`)
    } else if (!result.hasData) {
      noData++
      console.log(`${asset.ticker}: NO DATA`)
    } else {
      success++
    }
  }

  console.log(`\nResults:`)
  console.log(`  Success: ${success}`)
  console.log(`  No data: ${noData}`)
  console.log(`  Errors: ${errors}`)
}

test().catch(console.error)
