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
    console.log('=== AAPL DAILY_PRICES ===')
    const { data: prices, error } = await supabase
      .from('daily_prices')
      .select('date')
      .eq('ticker', 'AAPL')
      .order('date', { ascending: false })
      .limit(20)

    if (error) {
      console.log('Error:', error.message)
    } else {
      const dates = prices.map(p => p.date)
      console.log(`Latest 10 dates: ${dates.slice(0, 10).join(', ')}`)
      console.log(`Total rows for AAPL: ${prices.length}`)
    }

    // Check one specific date to see if data exists
    console.log('\n=== CHECK SEP 4 DATA ===')
    const { count } = await supabase
      .from('daily_prices')
      .select('*', { count: 'exact' })
      .eq('ticker', 'AAPL')
      .eq('date', '2026-09-04')

    console.log(`AAPL rows for 2026-09-04: ${count}`)
    
  } catch (err) {
    console.error('Error:', err.message)
  }
  process.exit(0)
})();
