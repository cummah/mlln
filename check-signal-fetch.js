const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const client = createClient(supabaseUrl, supabaseKey)

async function testFetch() {
  // Simulate what getBacktestSignals does for daily
  const ticker = 'AAPL'
  const { data: dataRaw, error } = await client
    .from('daily_signals')
    .select('signals_1y, current_signal')
    .eq('ticker', ticker.toUpperCase())
    .single()

  if (error || !dataRaw) {
    console.log(`No cached daily signals for ${ticker}`)
    return
  }

  const signalsData = dataRaw.signals_1y || []
  
  console.log(`${ticker}: ${signalsData.length} total signals`)
  
  // Filter out skipped like getLatestSignal does
  const validSignals = signalsData.filter(s => !s.skipped)
  console.log(`${ticker}: ${validSignals.length} valid signals (not skipped)`)
  
  if (validSignals.length > 0) {
    const latest = validSignals[validSignals.length - 1]
    console.log(`Latest valid signal: ${latest.date}, finalMult=${latest.finalMult}, exitOpen=${latest.exitOpen}`)
  }

  // Test a few more tickers
  const tickers = ['MSFT', 'GOOGL', 'TSLA', 'AMZN', 'NVDA', 'META']
  
  for (const tk of tickers) {
    const { data: d } = await client
      .from('daily_signals')
      .select('signals_1y')
      .eq('ticker', tk)
      .single()
    
    if (d && d.signals_1y) {
      const valid = d.signals_1y.filter(s => !s.isSkipped).length
      console.log(`${tk}: ${valid} valid out of ${d.signals_1y.length}`)
    }
  }
}

testFetch().catch(console.error)
