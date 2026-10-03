const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manual implementation to test just AAPL
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
    console.log('Testing AAPL daily signals generation...\n')
    
    // 1. Get price data
    const { data: prices } = await supabase
      .from('daily_prices')
      .select('date, close')
      .eq('ticker', 'AAPL')
      .order('date', { ascending: true })

    console.log(`Fetched ${prices?.length || 0} price bars`)
    if (prices && prices.length > 0) {
      console.log(`Date range: ${prices[0].date} to ${prices[prices.length - 1].date}`)
    }

    // 2. Check current daily_signals for AAPL
    const { data: current } = await supabase
      .from('daily_signals')
      .select('ticker, updated_at, signals_1y')
      .eq('ticker', 'AAPL')
      .single()

    if (current) {
      const dates = (current.signals_1y || []).map(s => s.date).sort().reverse()
      console.log(`\nCurrent daily_signals for AAPL:`)
      console.log(`  Updated at: ${current.updated_at}`)
      console.log(`  Total signals: ${current.signals_1y?.length || 0}`)
      console.log(`  Latest dates: ${dates.slice(0, 5).join(', ')}`)
    } else {
      console.log('No existing daily_signals for AAPL')
    }
    
  } catch (err) {
    console.error('Error:', err.message)
  }
  process.exit(0)
})();
