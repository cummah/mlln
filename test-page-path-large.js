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

  if (error || !dataRaw) {
    return null
  }

  const signalsData = (dataRaw).signals_1y || []

  const signals = signalsData.map((d) => ({
    date: d.date,
    mult: d.finalMult || 0,
    skipped: d.finalMult === 0,
  }))

  return { signals }
}

function getLatestSignal(signals) {
  if (!signals) return null
  const validSignals = signals.filter(s => !s.skipped)
  if (validSignals.length === 0) return null
  return validSignals[validSignals.length - 1]
}

async function testPage() {
  const { data: allAssets } = await client
    .from('assets')
    .select('ticker')
    .eq('is_active', true)

  console.log(`Testing ${allAssets.length} assets...`)

  let returnedNull = 0
  let noLatest = 0
  let hasSignal = 0

  // Test all assets
  for (const asset of allAssets) {
    const signalData = await getBacktestSignals(asset.ticker)
    
    if (!signalData) {
      returnedNull++
      continue
    }

    const latestSignal = getLatestSignal(signalData.signals || [])
    if (!latestSignal) {
      noLatest++
    } else {
      hasSignal++
    }
  }

  console.log(`\nResults for all ${allAssets.length}:`)
  console.log(`  getBacktestSignals returned null: ${returnedNull}`)
  console.log(`  No latest signal (all skipped): ${noLatest}`)
  console.log(`  Has valid latest signal: ${hasSignal}`)
}

testPage().catch(console.error)
