const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const client = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data } = await client
    .from('daily_signals')
    .select('ticker, signals_1y')
    .limit(10)

  let totalSignals = 0
  let matches = 0
  let mismatches = 0
  const examples = []

  data?.forEach(rec => {
    if (!rec.signals_1y || !Array.isArray(rec.signals_1y)) return

    rec.signals_1y.forEach(sig => {
      totalSignals++
      const isSkipped = sig.isSkipped
      const multIsZero = sig.finalMult === 0
      
      // They should match: isSkipped should be true iff finalMult === 0
      if (isSkipped === multIsZero) {
        matches++
      } else {
        mismatches++
        if (examples.length < 5) {
          examples.push({
            ticker: rec.ticker,
            date: sig.date,
            isSkipped,
            finalMult: sig.finalMult
          })
        }
      }
    })
  })

  console.log(`Sample of signals from 10 assets:`)
  console.log(`  Total signals: ${totalSignals}`)
  console.log(`  isSkipped matches finalMult===0: ${matches}`)
  console.log(`  Mismatches: ${mismatches}`)
  
  if (mismatches > 0) {
    console.log(`\nMismatches (isSkipped != (finalMult===0)):`)
    examples.forEach(ex => {
      console.log(`  ${ex.ticker} ${ex.date}: isSkipped=${ex.isSkipped}, finalMult=${ex.finalMult}`)
    })
  }
}

check().catch(console.error)
