const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const client = createClient(supabaseUrl, supabaseKey)

async function check() {
  // Get all assets
  const { data: assets } = await client
    .from('assets')
    .select('ticker, name')
    .eq('is_active', true)
    .order('ticker')

  // Get all daily signals
  const { data: signals } = await client
    .from('daily_signals')
    .select('ticker')

  const signalTickers = new Set(signals.map(s => s.ticker))
  
  let assetsWithoutRecords = 0
  const examples = []

  assets?.forEach(asset => {
    if (!signalTickers.has(asset.ticker)) {
      assetsWithoutRecords++
      if (examples.length < 10) {
        examples.push(asset.ticker)
      }
    }
  })

  console.log(`Assets without daily_signals records: ${assetsWithoutRecords}`)
  console.log(`Examples: ${examples.join(', ')}`)

  // Now check which assets have records but no signals in signals_1y
  const { data: allSignals } = await client
    .from('daily_signals')
    .select('ticker, signals_1y')

  let emptySignals = 0
  const emptyExamples = []

  allSignals?.forEach(rec => {
    if (!rec.signals_1y || !Array.isArray(rec.signals_1y) || rec.signals_1y.length === 0) {
      emptySignals++
      if (emptyExamples.length < 10) {
        emptyExamples.push(rec.ticker)
      }
    }
  })

  console.log(`\nAssets with daily_signals records but empty signals_1y: ${emptySignals}`)
  console.log(`Examples: ${emptyExamples.join(', ')}`)
}

check().catch(console.error)
