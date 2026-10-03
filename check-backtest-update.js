const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Load env vars
const envPath = path.resolve(__dirname, '.env.local');
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

async function main() {
  console.log('\n=== Checking backtest_signals Updates ===\n');

  // Get most recent updated_at
  const { data: recent } = await supabase
    .from('backtest_signals')
    .select('ticker, updated_at')
    .order('updated_at', { ascending: false })
    .limit(5);

  console.log('Most recent backtest_signals updates:');
  recent?.forEach(row => {
    const date = new Date(row.updated_at);
    console.log(`  ${row.ticker}: ${date.toLocaleString()}`);
  });

  // Check if any backtest has September signals
  console.log('\n=== Checking for September Signals ===\n');

  const { data: allSignals } = await supabase
    .from('backtest_signals')
    .select('ticker, signals_5y_monthly');

  let septemberSignalCount = 0;
  let tickersWithSeptemberSignals = [];

  allSignals?.forEach(row => {
    const signals = row.signals_5y_monthly || [];
    signals.forEach(sig => {
      if (sig.date && sig.date.startsWith('2026-09')) {
        septemberSignalCount++;
        if (!tickersWithSeptemberSignals.includes(row.ticker)) {
          tickersWithSeptemberSignals.push(row.ticker);
        }
      }
    });
  });

  console.log(`Total September monthly signals: ${septemberSignalCount}`);
  if (tickersWithSeptemberSignals.length > 0) {
    console.log(`Tickers with September signals: ${tickersWithSeptemberSignals.slice(0, 10).join(', ')}`);
  } else {
    console.log('NO monthly signals for September in any ticker');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
