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
  const { data: msft } = await supabase
    .from('daily_signals')
    .select('signals_1y')
    .eq('ticker', 'MSFT')
    .single()

  const dates = (msft?.signals_1y || []).map(s => s.date).sort().reverse()
  process.stdout.write(`MSFT latest: ${dates[0] || 'none'}\n`)
  process.exit(0)
})();
