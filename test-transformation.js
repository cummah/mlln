const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const client = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data: dataRaw } = await client
    .from('daily_signals')
    .select('signals_1y')
    .eq('ticker', 'AAPL')
    .single()

  const signalsData = dataRaw.signals_1y || []
  
  console.log(`Raw signals: ${signalsData.length}`)
  
  // Transform like backtest-signals.ts does
  const signals = signalsData.map((d) => ({
    date: d.date,
    mult: d.finalMult || 0,
    skipped: d.finalMult === 0,
    buyAmount: 100 * (d.finalMult || 0),
  }))
  
  // Filter like getLatestSignal does
  const validSignals = signals.filter(s => !s.skipped)
  
  console.log(`After transformation:`)
  console.log(`  Total: ${signals.length}`)
  console.log(`  Valid (not skipped): ${validSignals.length}`)
  console.log(`  Skipped: ${signals.filter(s => s.skipped).length}`)
  
  if (validSignals.length > 0) {
    const latest = validSignals[validSignals.length - 1]
    console.log(`\nLatest valid: date=${latest.date}, mult=${latest.mult}`)
  }

  // Compare with raw
  const rawSkipped = signalsData.filter(s => s.isSkipped === true).length
  const rawWithMult = signalsData.filter(s => s.finalMult > 0).length
  
  console.log(`\nRaw data:`)
  console.log(`  isSkipped===true: ${rawSkipped}`)
  console.log(`  finalMult > 0: ${rawWithMult}`)
}

test().catch(console.error)
