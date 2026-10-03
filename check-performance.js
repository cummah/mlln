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

  // Find some signals and check their performance
  const signals = data.signals_1y
    .filter(s => s.finalMult > 0)
    .slice(0, 5)

  console.log('Sample signals:')
  signals.forEach(sig => {
    console.log(`  ${sig.date}: mult=${sig.finalMult.toFixed(3)}, exitReturn=${sig.exitReturn}, invested=${(100*sig.finalMult).toFixed(0)}`)
  })

  // Check for any with weird exit return values
  const weird = data.signals_1y.filter(s => s.exitReturn === -100)
  console.log(`\nSignals with exitReturn === -100: ${weird.length}`)
  if (weird.length > 0) {
    console.log('Examples:')
    weird.slice(0, 3).forEach(s => {
      console.log(`  ${s.date}: mult=${s.finalMult}, exitReturn=${s.exitReturn}, exitOpen=${s.exitOpen}`)
    })
  }
}

check().catch(console.error)
