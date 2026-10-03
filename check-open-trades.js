const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const client = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data } = await client
    .from('daily_signals')
    .select('ticker, signals_1y')
    .eq('ticker', 'AAPL')
    .single()

  if (!data?.signals_1y) return

  // Find open trades from today/yesterday
  const now = new Date()
  const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0]
  const today = now.toISOString().split('T')[0]

  const recent = data.signals_1y.filter(s => 
    s.finalMult > 0 && 
    (s.date === yesterday || s.date === today)
  )

  console.log(`Signals from ${yesterday} and ${today}:`)
  recent.forEach(sig => {
    console.log(`  ${sig.date}: mult=${sig.finalMult.toFixed(3)}, exitOpen=${sig.exitOpen}, exitReturn=${sig.exitReturn}`)
  })

  // Check all recent signals (last 10 valid ones)
  const allValid = data.signals_1y.filter(s => s.finalMult > 0)
  console.log(`\nLast 10 signals:`)
  allValid.slice(-10).forEach(sig => {
    console.log(`  ${sig.date}: mult=${sig.finalMult.toFixed(3)}, exitOpen=${sig.exitOpen}, exitReturn=${sig.exitReturn}`)
  })
}

check().catch(console.error)
