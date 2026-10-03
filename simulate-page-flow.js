const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const client = createClient(supabaseUrl, supabaseKey)

async function getAllAssets() {
  const { data } = await client
    .from('assets')
    .select('ticker, name, sector')
    .eq('is_active', true)
    .order('ticker')
  return data || []
}

async function getBacktestSignals(ticker) {
  const { data: dataRaw, error } = await client
    .from('daily_signals')
    .select('signals_1y, current_signal')
    .eq('ticker', ticker.toUpperCase())
    .single()

  if (error || !dataRaw) {
    return null
  }

  const signalsData = dataRaw.signals_1y || []
  
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

async function simulate() {
  console.log('Fetching assets...')
  const assets = await getAllAssets()
  console.log(`Got ${assets.length} assets`)

  let returnedNull = 0
  let noLatestSignal = 0
  let hasSignal = 0

  const sample = []

  for (let i = 0; i < Math.min(assets.length, 50); i++) {
    const asset = assets[i]
    const signalData = await getBacktestSignals(asset.ticker)
    
    if (!signalData) {
      returnedNull++
      if (sample.length < 3) sample.push(`${asset.ticker}: NULL`)
      continue
    }

    const latestSignal = getLatestSignal(signalData.signals || [])
    if (!latestSignal) {
      noLatestSignal++
      if (sample.length < 3 && !sample.some(s => s.includes('NULL'))) {
        sample.push(`${asset.ticker}: NO LATEST SIGNAL`)
      }
    } else {
      hasSignal++
      if (sample.length < 3 && !sample.some(s => s.includes('NULL') || s.includes('LATEST'))) {
        sample.push(`${asset.ticker}: HAS SIGNAL (${latestSignal.date})`)
      }
    }
  }

  console.log(`\nSample of 50 assets:`)
  console.log(`  Returned NULL: ${returnedNull}`)
  console.log(`  No latest signal (all skipped): ${noLatestSignal}`)
  console.log(`  Has signal: ${hasSignal}`)
  console.log(`  Examples: ${sample.join(', ')}`)
  
  // Estimate for all
  const estTotal = assets.length
  const estNull = Math.round(estTotal * returnedNull / 50)
  const estNoLatest = Math.round(estTotal * noLatestSignal / 50)
  const estHas = Math.round(estTotal * hasSignal / 50)
  
  console.log(`\nEstimate for all ${estTotal}:`)
  console.log(`  Returned NULL: ${estNull}`)
  console.log(`  No latest signal: ${estNoLatest}`)
  console.log(`  Has signal: ${estHas}`)
}

simulate().catch(console.error)
