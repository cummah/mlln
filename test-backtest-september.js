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
  console.log('\n=== Testing Backtest Signal Generation ===\n');

  // Get all backtest_signals to analyze
  const { data: allBacktests } = await supabase
    .from('backtest_signals')
    .select('ticker, updated_at, signals_5y_monthly')
    .order('updated_at', { ascending: false });

  // Group by updated_at date
  const byDate = {};
  allBacktests?.forEach(row => {
    const date = row.updated_at.split('T')[0];
    if (!byDate[date]) byDate[date] = { count: 0, tickers: [] };
    byDate[date].count++;
    byDate[date].tickers.push(row.ticker);
  });

  console.log('backtest_signals update dates:');
  Object.entries(byDate)
    .sort(([a], [b]) => b.localeCompare(a))
    .forEach(([date, info]) => {
      console.log(`  ${date}: ${info.count} rows`);
      if (info.count <= 5) {
        console.log(`    Tickers: ${info.tickers.join(', ')}`);
      }
    });

  // Check if compute:summary actually updated anything
  console.log('\n=== Checking if compute:summary updated backtest_signals ===\n');

  const todayStart = new Date('2026-09-03T00:00:00Z').toISOString();
  const { data: todayUpdates } = await supabase
    .from('backtest_signals')
    .select('ticker, updated_at')
    .gte('updated_at', todayStart)
    .order('updated_at', { ascending: false });

  if (todayUpdates && todayUpdates.length > 0) {
    console.log(`✓ Found ${todayUpdates.length} rows updated on 2026-09-03:`);
    const sample = todayUpdates.slice(0, 5);
    sample.forEach(row => {
      const time = new Date(row.updated_at).toLocaleTimeString();
      console.log(`  ${row.ticker}: ${time}`);
    });
  } else {
    console.log(`✗ NO rows updated on 2026-09-03`);
    console.log(`  compute:summary did NOT update backtest_signals table!`);
  }

  // Check if there's an is_new_asset flag to see if compute:summary ran
  console.log('\n=== Checking for is_new_asset column ===\n');

  const { data: checkColumn } = await supabase
    .from('backtest_signals')
    .select('is_new_asset')
    .limit(1);

  if (checkColumn && checkColumn[0] !== undefined) {
    console.log(`✓ is_new_asset column exists`);
  } else {
    console.log(`✗ is_new_asset column NOT found`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
