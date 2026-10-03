const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const client = createClient(supabaseUrl, supabaseKey)

async function getBacktestSignals(ticker) {
  const { data, error } = await client
    .from('daily_signals')
    .select('signals_1y')
    .eq('ticker', ticker.toUpperCase())
    .single()

  return data?.signals_1y ? { signals: data.signals_1y } : null
}

async function fetchOHLC(ticker) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 365)
  const startDateStr = startDate.toISOString().split('T')[0]

  try {
    const result = await client
      .from('daily_prices')
      .select('date, close')
      .eq('ticker', ticker)
      .gte('date', startDateStr)
      .limit(1000)

    return result.data || []
  } catch (err) {
    return []
  }
}

async function test() {
  const { data: assets } = await client
    .from('assets')
    .select('ticker')
    .eq('is_active', true)
    .order('ticker')
    .limit(100)

  console.log(`Testing Promise.all for ${assets.length} assets...`)
  const start = Date.now()

  const promises = assets.map(async (asset) => {
    try {
      const [signalData, ohlcData] = await Promise.all([
        getBacktestSignals(asset.ticker),
        fetchOHLC(asset.ticker)
      ])
      return { ticker: asset.ticker, hasSignals: !!signalData, hasOHLC: ohlcData.length > 0, error: null }
    } catch (err) {
      return { ticker: asset.ticker, error: err.message }
    }
  })

  const results = await Promise.all(promises)
  const elapsed = Date.now() - start

  const success = results.filter(r => !r.error).length
  const failed = results.filter(r => r.error).length

  console.log(`\nCompleted in ${elapsed}ms:`)
  console.log(`  Success: ${success}`)
  console.log(`  Failed: ${failed}`)

  if (failed > 0) {
    console.log(`\nFailed assets:`)
    results.filter(r => r.error).forEach(r => {
      console.log(`  ${r.ticker}: ${r.error}`)
    })
  }
}

test().catch(console.error)
