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
    // Check the previously stuck tickers
    const testTickers = ['ST', 'HNI', 'SFL', 'AAPL']
    
    console.log('=== AFTER ENRICHMENT RUN ===\n')
    
    for (const ticker of testTickers) {
      const { data: enriched } = await supabase
        .from('daily_signal_enrichment')
        .select('signals')
        .eq('ticker', ticker)
        .single()

      const dates = (enriched?.signals || []).map(s => s.date).sort().reverse()
      console.log(`${ticker}: latest = ${dates[0] || 'none'} (${enriched?.signals?.length || 0} signals)`)
    }
    
  } catch (err) {
    console.error('Error:', err.message)
  }
  process.exit(0)
})();
