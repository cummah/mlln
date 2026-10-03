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
    console.log('=== AAPL PRICE DATA ===\n')
    
    const { data: latest } = await supabase
      .from('daily_prices')
      .select('date')
      .eq('ticker', 'AAPL')
      .order('date', { ascending: false })
      .limit(10)

    console.log('Latest 10 dates in daily_prices:')
    (latest || []).forEach(r => console.log(`  ${r.date}`))

    const { count } = await supabase
      .from('daily_prices')
      .select('*', { count: 'exact' })
      .eq('ticker', 'AAPL')

    console.log(`\nTotal AAPL price rows: ${count}`)

    // Check if Sep 4 exists
    const { data: sep4 } = await supabase
      .from('daily_prices')
      .select('close')
      .eq('ticker', 'AAPL')
      .eq('date', '2026-09-04')
      .single()

    console.log(`Sep 4 data exists: ${sep4 ? 'YES' : 'NO'}`)
    
  } catch (err) {
    console.error('Error:', err.message)
  }
  process.exit(0)
})();
