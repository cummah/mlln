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
    // Get a sample signal to see the dates
    const { data: sample } = await supabase
      .from('daily_signals')
      .select('ticker, signals_1y')
      .limit(1)

    if (sample && sample.length > 0) {
      const ticker = sample[0].ticker
      const signals = sample[0].signals_1y || []
      console.log(`Sample ticker: ${ticker}`)
      console.log(`Total signals: ${signals.length}`)
      
      if (signals.length > 0) {
        const dates = signals.map(s => s.date).sort().reverse()
        console.log(`\nLatest 10 signal dates:`)
        dates.slice(0, 10).forEach(d => console.log(`  ${d}`))
      }
    }
    
  } catch (err) {
    console.error('Error:', err.message)
  }
  process.exit(0)
})();
