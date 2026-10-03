const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const client = createClient(supabaseUrl, supabaseKey)

async function countAllSignals() {
  console.log('Fetching all daily_signals records...')
  
  let offset = 0
  let totalSignals = 0
  let recordCount = 0
  let totalChars = 0
  const sample = []

  while (true) {
    const { data, error } = await client
      .from('daily_signals')
      .select('ticker, signals_1y')
      .range(offset, offset + 99)

    if (error) {
      console.error('Error:', error)
      break
    }

    if (!data || data.length === 0) break

    recordCount += data.length

    data.forEach(rec => {
      if (rec.signals_1y && Array.isArray(rec.signals_1y)) {
        const count = rec.signals_1y.length
        totalSignals += count
        
        // Store char count for one
        if (sample.length < 3) {
          const jsonStr = JSON.stringify(rec.signals_1y)
          totalChars += jsonStr.length
          sample.push({
            ticker: rec.ticker,
            signalCount: count,
            charCount: jsonStr.length
          })
        }
      }
    })

    offset += 100
  }

  console.log(`\nDatabase scan complete:`)
  console.log(`  Records: ${recordCount}`)
  console.log(`  Total signals: ${totalSignals}`)
  console.log(`  Avg signals per asset: ${(totalSignals / recordCount).toFixed(1)}`)
  console.log(`\nSample (char count):`)
  sample.forEach(s => {
    console.log(`  ${s.ticker}: ${s.signalCount} signals, ${s.charCount} chars`)
  })
}

countAllSignals().catch(console.error)
