const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const client = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data: allSignals } = await client
    .from('daily_signals')
    .select('ticker, signals_1y')

  let allSkipped = 0
  let hasValidSignals = 0
  const allSkippedExamples = []

  allSignals?.forEach(rec => {
    if (!rec.signals_1y || !Array.isArray(rec.signals_1y)) {
      return
    }

    const totalSignals = rec.signals_1y.length
    const skippedCount = rec.signals_1y.filter(s => s.isSkipped === true || s.finalMult === 0).length
    const validCount = totalSignals - skippedCount

    if (validCount === 0) {
      allSkipped++
      if (allSkippedExamples.length < 15) {
        allSkippedExamples.push(rec.ticker)
      }
    } else {
      hasValidSignals++
    }
  })

  console.log(`Assets with at least one valid signal: ${hasValidSignals}`)
  console.log(`Assets where ALL signals are skipped: ${allSkipped}`)
  console.log(`Examples of all-skipped: ${allSkippedExamples.join(', ')}`)
}

check().catch(console.error)
