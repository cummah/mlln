const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const client = createClient(supabaseUrl, supabaseKey)

async function check() {
  let offset = 0
  let lastIsValid = 0
  let lastIsSkipped = 0

  while (true) {
    const { data } = await client
      .from('daily_signals')
      .select('ticker, signals_1y')
      .range(offset, offset + 99)

    if (!data || data.length === 0) break

    data.forEach(rec => {
      if (!rec.signals_1y || !Array.isArray(rec.signals_1y) || rec.signals_1y.length === 0) return

      const lastSignal = rec.signals_1y[rec.signals_1y.length - 1]
      if (lastSignal.finalMult > 0) {
        lastIsValid++
      } else {
        lastIsSkipped++
      }
    })

    offset += 100
  }

  const total = lastIsValid + lastIsSkipped
  console.log(`Latest Signal Analysis:`)
  console.log(`  Assets where LATEST signal is valid (finalMult > 0): ${lastIsValid}`)
  console.log(`  Assets where LATEST signal is skipped (finalMult = 0): ${lastIsSkipped}`)
  console.log(`  Total: ${total}`)
  console.log(`\nSo for latest signal, should display: ${lastIsValid} (if filtering for latest only)`)
}

check().catch(console.error)
