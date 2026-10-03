const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  try {
    // Check daily_signals latest dates (5 samples)
    console.log('=== DAILY_SIGNALS TABLE ===')
    const { data: dailySamples } = await supabase
      .from('daily_signals')
      .select('ticker, signals_1y')
      .limit(5)

    if (dailySamples) {
      dailySamples.forEach(row => {
        const dates = (row.signals_1y || []).map(s => s.date).sort().reverse()
        console.log(`${row.ticker}: ${dates.length} signals, latest: ${dates[0] || 'none'}`)
      })
    }

    // Check daily_signal_enrichment latest dates (5 samples)
    console.log('\n=== DAILY_SIGNAL_ENRICHMENT TABLE ===')
    const { data: enrichSamples } = await supabase
      .from('daily_signal_enrichment')
      .select('ticker, signals, updated_at')
      .limit(5)

    if (enrichSamples) {
      enrichSamples.forEach(row => {
        const dates = (row.signals || []).map(s => s.date).sort().reverse()
        const updated = new Date(row.updated_at).toISOString().split('T')[0]
        console.log(`${row.ticker}: ${dates.length} signals, latest: ${dates[0] || 'none'}, enriched: ${updated}`)
      })
    }

    // Check if there's a gap
    console.log('\n=== VERIFICATION ===')
    const { data: aapl } = await supabase
      .from('daily_signals')
      .select('signals_1y')
      .eq('ticker', 'AAPL')
      .single()

    if (aapl?.signals_1y) {
      const aaplDates = aapl.signals_1y.map(s => s.date).sort().reverse()
      console.log(`AAPL daily_signals: ${aaplDates.slice(0, 5).join(', ')}`)
    }

    const { data: enriched } = await supabase
      .from('daily_signal_enrichment')
      .select('signals')
      .eq('ticker', 'AAPL')
      .single()

    if (enriched?.signals) {
      const enrichDates = enriched.signals.map(s => s.date).sort().reverse()
      console.log(`AAPL enrichment:     ${enrichDates.slice(0, 5).join(', ')}`)
    }
    
  } catch (err) {
    console.error('Error:', err.message)
  }
  process.exit(0)
})();
