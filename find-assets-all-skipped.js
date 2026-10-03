const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const client = createClient(supabaseUrl, supabaseKey)

async function analyzeSignals() {
  let offset = 0
  let assetsWithValidSignals = 0
  let assetsAllSkipped = 0
  const allSkippedExamples = []

  while (true) {
    const { data } = await client
      .from('daily_signals')
      .select('ticker, signals_1y')
      .range(offset, offset + 99)

    if (!data || data.length === 0) break

    data.forEach(rec => {
      if (!rec.signals_1y || !Array.isArray(rec.signals_1y)) return

      const validCount = rec.signals_1y.filter(s => !s.isSkipped && s.finalMult > 0).length
      
      if (validCount > 0) {
        assetsWithValidSignals++
      } else {
        assetsAllSkipped++
        if (allSkippedExamples.length < 20) {
          allSkippedExamples.push(rec.ticker)
        }
      }
    })

    offset += 100
  }

  const total = assetsWithValidSignals + assetsAllSkipped
  console.log(`Signal Analysis:`)
  console.log(`  Assets with at least 1 valid signal: ${assetsWithValidSignals}`)
  console.log(`  Assets with ALL signals skipped: ${assetsAllSkipped}`)
  console.log(`  Total assets: ${total}`)
  console.log(`\nAssets with all skipped (examples):`)
  allSkippedExamples.forEach(t => console.log(`  ${t}`))
}

analyzeSignals().catch(console.error)
