const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const client = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data } = await client
    .from('daily_signals')
    .select('ticker, signals_1y')
    .limit(3)

  data?.forEach(rec => {
    if (rec.signals_1y && Array.isArray(rec.signals_1y)) {
      console.log(`\n${rec.ticker}: ${rec.signals_1y.length} signals`)
      
      const first = rec.signals_1y[0]
      const last = rec.signals_1y[rec.signals_1y.length - 1]
      
      console.log('First signal keys:', Object.keys(first))
      console.log('First signal:', JSON.stringify(first, null, 2).slice(0, 300))
      console.log('\nLast signal:', JSON.stringify(last, null, 2).slice(0, 300))
      
      const skipped = rec.signals_1y.filter(s => s.isSkipped === true)
      const withZeroMult = rec.signals_1y.filter(s => s.finalMult === 0)
      console.log(`Skipped (isSkipped=true): ${skipped.length}`)
      console.log(`Zero mult (finalMult=0): ${withZeroMult.length}`)
    }
  })
}

check().catch(console.error)
