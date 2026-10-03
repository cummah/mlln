const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const client = createClient(supabaseUrl, supabaseKey)

// Simulate getSignalDataForAsset
async function getSignalDataForAsset(ticker, dcaSuitabilityScore) {
  const signalData = await getBacktestSignals(ticker, 'daily')
  
  function getLatestSignal(signals) {
    if (!signals) return null
    const validSignals = signals.filter(s => !s.skipped)
    if (validSignals.length === 0) return null
    return validSignals[validSignals.length - 1]
  }

  const latestSignal = getLatestSignal(signalData?.signals || [])
  
  return {
    ticker,
    signalDate: latestSignal?.date || null,
    hasSignal: !!latestSignal,
  }
}

async function getBacktestSignals(ticker, frequency) {
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

async function test() {
  const assets = ['AAPL', 'MSFT', 'GOOGL', 'Q', '^VIX', 'FAGIX', 'SPY', 'QQQ', 'IWM', 'DIA']
  
  for (const ticker of assets) {
    const result = await getSignalDataForAsset(ticker, null)
    console.log(`${ticker}: signalDate=${result.signalDate} (${result.hasSignal ? 'HAS' : 'NO'} signal)`)
  }
}

test().catch(console.error)
