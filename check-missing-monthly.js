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

async function fetchAllPages(query) {
  const pageSize = 1000;
  let page = 0;
  const rows = [];
  while (true) {
    const start = page * pageSize;
    const result = query.range(start, start + pageSize - 1);
    const { data, error } = await result;
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  return rows;
}

async function main() {
  console.log('\n=== Finding Missing Monthly Signals ===\n');

  // Get all active assets
  const assets = await fetchAllPages(
    supabase
      .from('assets')
      .select('ticker')
      .eq('is_active', true)
      .order('ticker')
  );

  // Get all enriched tickers
  const enriched = await fetchAllPages(
    supabase
      .from('monthly_signal_enrichment')
      .select('ticker')
      .order('ticker')
  );

  const enrichedSet = new Set(enriched.map(r => r.ticker.toUpperCase()));
  const missingAssets = assets.filter(a => !enrichedSet.has(a.ticker.toUpperCase()));

  console.log(`Total active assets: ${assets.length}`);
  console.log(`Enriched tickers: ${enriched.length}`);
  console.log(`Missing enrichment: ${missingAssets.length}\n`);

  if (missingAssets.length > 0 && missingAssets.length <= 50) {
    console.log('Missing tickers:');
    missingAssets.forEach(a => console.log(`  ${a.ticker}`));
  } else if (missingAssets.length > 50) {
    console.log(`First 50 missing tickers:`);
    missingAssets.slice(0, 50).forEach(a => console.log(`  ${a.ticker}`));
    console.log(`  ... and ${missingAssets.length - 50} more`);
  }

  // Check if these assets have backtest_signals
  console.log('\n=== Checking if missing assets have backtest_signals ===\n');

  const missingTickers = missingAssets.map(a => a.ticker.toUpperCase()).slice(0, 10);
  const backtestRows = await supabase
    .from('backtest_signals')
    .select('ticker, signals_5y_monthly')
    .in('ticker', missingTickers);

  if (backtestRows.data) {
    console.log(`Checking first 10 missing assets in backtest_signals:`);
    backtestRows.data.forEach(row => {
      const signalCount = row.signals_5y_monthly ? row.signals_5y_monthly.length : 0;
      console.log(`  ${row.ticker}: ${signalCount} monthly signals`);
    });
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
