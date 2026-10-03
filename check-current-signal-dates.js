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
    // Sample 5 tickers
    const { data: tickers } = await supabase
      .from('daily_signals')
      .select('ticker')
      .limit(5)

    console.log('=== CURRENT STATE ===\n')
    
    for (const row of tickers || []) {
      const { data: daily } = await supabase
        .from('daily_signals')
        .select('signals_1y')
        .eq('ticker', row.ticker)
        .single()

      const { data: enriched } = await supabase
        .from('daily_signal_enrichment')
        .select('signals')
        .eq('ticker', row.ticker)
        .single()

      const dailyDates = (daily?.signals_1y || []).map(s => s.date).sort().reverse()
      const enrichedDates = (enriched?.signals || []).map(s => s.date).sort().reverse()
      
      console.log(`${row.ticker}:`)
      console.log(`  daily_signals latest: ${dailyDates[0] || 'none'}`)
      console.log(`  enrichment latest:    ${enrichedDates[0] || 'none'}`)
    }
    
  } catch (err) {
    console.error('Error:', err.message)
  }
  process.exit(0)
})();
