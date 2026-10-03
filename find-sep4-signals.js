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
    const { data: all } = await supabase
      .from('daily_signals')
      .select('ticker, signals_1y')

    let sep4Count = 0
    let sep3Count = 0
    let otherCount = 0

    for (const row of all || []) {
      const dates = (row.signals_1y || []).map(s => s.date).sort().reverse()
      if (dates[0] === '2026-09-04') sep4Count++
      else if (dates[0] === '2026-09-03') sep3Count++
      else otherCount++
    }

    process.stdout.write(`Signals by latest date:\n`)
    process.stdout.write(`  Sep 4: ${sep4Count}\n`)
    process.stdout.write(`  Sep 3: ${sep3Count}\n`)
    process.stdout.write(`  Other: ${otherCount}\n`)
    
  } catch (err) {
    process.stdout.write(`Error: ${err.message}\n`)
  }
  process.exit(0)
})();
