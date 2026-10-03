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
  const { data: latest, count } = await supabase
    .from('daily_prices')
    .select('date', { count: 'exact' })
    .eq('ticker', 'AAPL')
    .order('date', { ascending: false })
    .limit(5)

  process.stdout.write(`AAPL latest: ${latest?.[0]?.date || 'none'}, Total rows: ${count}\n`)
  process.exit(0)
})();
