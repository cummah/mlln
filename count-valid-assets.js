const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const client = createClient(supabaseUrl, supabaseKey)

async function test() {
  // Get all daily_signals with just ticker and count of valid signals
  const { data: allSignals } = await client
    .from('daily_signals')
    .select('ticker, signals_1y')
    .limit(100)  // Get a sample first

  if (!allSignals || allSignals.length === 0) {
    console.log('No data')
    return
  }

  let assetsWithValid = 0
  let assetsAllSkipped = 0
  const sample = []

  allSignals.forEach(rec => {
    if (!rec.signals_1y || !Array.isArray(rec.signals_1y)) {
      assetsAllSkipped++
      return
    }

    const validCount = rec.signals_1y.filter(s => s.finalMult > 0).length
    if (validCount > 0) {
      assetsWithValid++
      if (sample.length < 5) {
        sample.push(`${rec.ticker}: ${validCount}`)
      }
    } else {
      assetsAllSkipped++
    }
  })

  console.log(`Sample of 100:`)
  console.log(`  With at least 1 valid signal: ${assetsWithValid}`)
  console.log(`  All signals skipped (finalMult=0): ${assetsAllSkipped}`)
  console.log(`  Examples with signals: ${sample.join(', ')}`)
  
  // Estimate for all 706
  const estimatedWithSignals = Math.round(706 * assetsWithValid / 100)
  console.log(`\nEstimate for all 706:`)
  console.log(`  Assets with signals: ~${estimatedWithSignals}`)
  console.log(`  Assets with all-skipped: ~${706 - estimatedWithSignals}`)
}

test().catch(console.error)
