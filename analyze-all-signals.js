const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const client = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data: allSignals } = await client
    .from('daily_signals')
    .select('ticker, signals_1y')

  const analysis = (allSignals || [])
    .map(rec => {
      if (!rec.signals_1y || !Array.isArray(rec.signals_1y) || rec.signals_1y.length === 0) {
        return { ticker: rec.ticker, total: 0, valid: 0, skipped: 0, lastValid: null }
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

      return { ticker: rec.ticker, total, valid, skipped, lastValid }
    })
    .sort((a, b) => b.valid - a.valid)

  // Show stats
  const withNoValid = analysis.filter(a => a.valid === 0)
  const withSomeValid = analysis.filter(a => a.valid > 0)

  console.log(`Assets with at least 1 valid signal: ${withSomeValid.length}`)
  console.log(`Assets with 0 valid signals: ${withNoValid.length}`)
  console.log(`\nTop 10 by valid signal count:`)
  analysis.slice(0, 10).forEach(a => {
    console.log(`  ${a.ticker}: ${a.valid}/${a.total} (last: ${a.lastValid})`)
  })
  
  console.log(`\nBottom 10 (least valid signals):`)
  analysis.slice(-10).forEach(a => {
    console.log(`  ${a.ticker}: ${a.valid}/${a.total}`)
  })

  if (withNoValid.length > 0) {
    console.log(`\nAssets with 0 valid signals (first 15):`)
    withNoValid.slice(0, 15).forEach(a => {
      console.log(`  ${a.ticker}`)
    })
  }
}

check().catch(console.error)
