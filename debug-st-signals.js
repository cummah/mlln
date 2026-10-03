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
    console.log('=== DEBUG: Daily Signals Source Data ===\n')
    
    const { data: st } = await supabase
      .from('daily_signals')
      .select('signals_1y')
      .eq('ticker', 'ST')
      .single()

    if (st?.signals_1y) {
      const dates = st.signals_1y.map(s => s.date).sort().reverse()
      console.log(`ST daily_signals:`)
      console.log(`  Total: ${st.signals_1y.length}`)
      console.log(`  Latest 5: ${dates.slice(0, 5).join(', ')}`)
    } else {
      console.log('ST: No data in daily_signals!')
    }

    const { data: aapl } = await supabase
      .from('daily_signals')
      .select('signals_1y')
      .eq('ticker', 'AAPL')
      .single()

    if (aapl?.signals_1y) {
      const dates = aapl.signals_1y.map(s => s.date).sort().reverse()
      console.log(`\nAAPL daily_signals:`)
      console.log(`  Total: ${aapl.signals_1y.length}`)
      console.log(`  Latest 5: ${dates.slice(0, 5).join(', ')}`)
    } else {
      console.log('\nAAPL: No data in daily_signals!')
    }
    
  } catch (err) {
    console.error('Error:', err.message)
  }
  process.exit(0)
})();
