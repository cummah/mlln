const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve('.env.local');
let env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (match) env[match[1].trim()] = match[2].trim()
  }
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase
    .from('weekly_signal_enrichment')
    .select('ticker, signals')
    .in('ticker', ['BBW', 'LUMN', 'ONON']);

  if (error) {
    console.error('Query error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No data found for those tickers');
    return;
  }

  for (const row of data) {
    console.log(`\n=== ${row.ticker} ===`);
    const signals = row.signals || [];
    for (const sig of signals.slice(0, 10)) {
      console.log(`Date: ${sig.date}, ExitOpen: ${sig.exitOpen}, ExitDate: ${sig.exitDate}, ExitReturn: ${sig.exitReturn}, Perf: ${sig.performance}`);
    }
  }
}

check().catch(err => console.error('Fatal:', err));
