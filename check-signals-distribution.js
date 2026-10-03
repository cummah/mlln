const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const client = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data: allRecs } = await client
    .from('daily_signals')
    .select('ticker, signals_1y')

  let hasSignals = 0
  let noSignals = 0
  const examples = []

  allRecs?.forEach(rec => {
    const count = Array.isArray(rec.signals_1y) ? rec.signals_1y.length : 0
    if (count === 0) {
      noSignals++
      if (examples.length < 5) {
        examples.push(`${rec.ticker}: 0 signals`)
      }
    } else {
      hasSignals++
      if (examples.length < 5 && hasSignals <= 2) {
        examples.push(`${rec.ticker}: ${count} signals`)
      }
    }
  })

  console.log(`Assets with signals: ${hasSignals}`)
  console.log(`Assets without signals: ${noSignals}`)
  console.log(`\nExamples:`)
  examples.forEach(e => console.log(`  ${e}`))

  // Check latest signal dates
  const { data: withDates } = await client
    .from('daily_signals')
    .select('ticker, signals_1y')

  const latestDates = []
  withDates?.forEach(rec => {
    if (rec.signals_1y && Array.isArray(rec.signals_1y) && rec.signals_1y.length > 0) {
      const latest = rec.signals_1y[rec.signals_1y.length - 1]
      latestDates.push({
        ticker: rec.ticker,
        latestSignalDate: latest.date,
        exitOpen: latest.exitOpen
      })
    }
  })

  // Group by latest signal date
  const byDate = {}
  latestDates.forEach(item => {
    if (!byDate[item.latestSignalDate]) {
      byDate[item.latestSignalDate] = 0
    }
    byDate[item.latestSignalDate]++
  })

  console.log(`\nLatest signal dates (top 10):`)
  Object.entries(byDate)
    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
    .slice(0, 10)
    .forEach(([date, count]) => {
      console.log(`  ${date}: ${count} assets`)
    })
}

check().catch(console.error)
