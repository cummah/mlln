const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const client = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data: allSignals, error } = await client
    .from('daily_signals')
    .select('ticker, signals_1y')

  console.log('Error:', error)
  console.log('Records fetched:', allSignals?.length)

  if (!allSignals || allSignals.length === 0) {
    console.log('No data returned')
    return
  }

  const analysis = []
  
  for (const rec of allSignals) {
    if (!rec.signals_1y || !Array.isArray(rec.signals_1y) || rec.signals_1y.length === 0) {
      analysis.push({ ticker: rec.ticker, total: 0, valid: 0, skipped: 0, lastValid: null })
      continue
    }

    const total = rec.signals_1y.length
    const valid = rec.signals_1y.filter(s => !s.isSkipped).length
    const skipped = total - valid
    
    // Find last valid signal
    let lastValid = null
    for (let i = rec.signals_1y.length - 1; i >= 0; i--) {
      if (!rec.signals_1y[i].isSkipped) {
        lastValid = rec.signals_1y[i].date
        break
      }
    }

    analysis.push({ ticker: rec.ticker, total, valid, skipped, lastValid })
  }

  analysis.sort((a, b) => b.valid - a.valid)

  // Show stats
  const withNoValid = analysis.filter(a => a.valid === 0)
  const withSomeValid = analysis.filter(a => a.valid > 0)

  console.log(`\nAssets with at least 1 valid signal: ${withSomeValid.length}`)
  console.log(`Assets with 0 valid signals: ${withNoValid.length}`)
  console.log(`\nTop 10 by valid signal count:`)
  analysis.slice(0, 10).forEach(a => {
    console.log(`  ${a.ticker}: ${a.valid}/${a.total} (last: ${a.lastValid})`)
  })
  
  console.log(`\nAssets with 0 valid signals (first 20):`)
  withNoValid.slice(0, 20).forEach(a => {
    console.log(`  ${a.ticker}: ${a.total} signals, all skipped`)
  })
}

check().catch(console.error)
