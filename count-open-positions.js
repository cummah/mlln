const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const client = createClient(supabaseUrl, supabaseKey)

async function count() {
  let offset = 0
  let totalOpen = 0
  let totalClosed = 0

  while (true) {
    const { data } = await client
      .from('daily_signals')
      .select('ticker, signals_1y')
      .range(offset, offset + 99)

    if (!data || data.length === 0) break

    data.forEach(rec => {
      if (!rec.signals_1y || !Array.isArray(rec.signals_1y)) return

      rec.signals_1y.forEach(sig => {
        if (sig.finalMult > 0) {  // Only count valid entries
          if (sig.exitOpen === true) {
            totalOpen++
          } else {
            totalClosed++
          }
        }
      })
    })

    offset += 100
  }

  console.log(`Position Status:`)
  console.log(`  Open (exitOpen=true): ${totalOpen}`)
  console.log(`  Closed (exitOpen=false): ${totalClosed}`)
  console.log(`  Total entries: ${totalOpen + totalClosed}`)
}

count().catch(console.error)
