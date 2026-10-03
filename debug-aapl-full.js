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
    console.log('=== AAPL DATA ISSUES ===')
    
    // Count ALL rows for AAPL
    const { count, error } = await supabase
      .from('daily_prices')
      .select('*', { count: 'exact' })
      .eq('ticker', 'AAPL')

    console.log(`Total rows for AAPL: ${count}`)

    if (count < 200) {
      console.log(`ERROR: Only ${count} rows - need 200+ for DCA engine`)
      
      // Get the date range
      const { data: allData } = await supabase
        .from('daily_prices')
        .select('date')
        .eq('ticker', 'AAPL')
        .order('date', { ascending: true })

      if (allData && allData.length > 0) {
        console.log(`Date range: ${allData[0].date} to ${allData[allData.length - 1].date}`)
      }
    }
    
  } catch (err) {
    console.error('Error:', err.message)
  }
  process.exit(0)
})();
