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
  console.log('\n=== Checking Monthly Signal Enrichment ===\n');

  // Check monthly_signal_enrichment table row count
  const { count: enrichmentCount, error: enrichmentError } = await supabase
    .from('monthly_signal_enrichment')
    .select('*', { count: 'exact', head: true });

  if (enrichmentError) {
    console.error('Error fetching enrichment count:', enrichmentError);
  } else {
    console.log(`monthly_signal_enrichment table: ${enrichmentCount} rows`);
  }

  // Sample a few rows from monthly_signal_enrichment
  const { data: enrichmentSample, error: enrichmentSampleError } = await supabase
    .from('monthly_signal_enrichment')
    .select('ticker, updated_at')
    .limit(5);

  if (enrichmentSampleError) {
    console.error('Error fetching enrichment sample:', enrichmentSampleError);
  } else {
    console.log('\nSample rows from monthly_signal_enrichment:');
    if (enrichmentSample && enrichmentSample.length > 0) {
      enrichmentSample.forEach(row => {
        console.log(`  ${row.ticker}: updated ${row.updated_at}`);
      });
    } else {
      console.log('  (no rows)');
    }
  }

  // Check backtest_signals table for monthly signals
  console.log('\n=== Checking backtest_signals ===\n');

  const { count: backtestCount, error: backtestError } = await supabase
    .from('backtest_signals')
    .select('*', { count: 'exact', head: true });

  if (backtestError) {
    console.error('Error fetching backtest_signals count:', backtestError);
  } else {
    console.log(`backtest_signals table: ${backtestCount} rows`);
  }

  // Sample backtest_signals and check if signals_5y_monthly is populated
  const { data: backtestSample, error: backtestSampleError } = await supabase
    .from('backtest_signals')
    .select('ticker, signals_5y_monthly')
    .limit(5);

  if (backtestSampleError) {
    console.error('Error fetching backtest sample:', backtestSampleError);
  } else {
    console.log('\nSample rows from backtest_signals (signals_5y_monthly):');
    if (backtestSample && backtestSample.length > 0) {
      backtestSample.forEach(row => {
        const signalCount = row.signals_5y_monthly ? row.signals_5y_monthly.length : 0;
        console.log(`  ${row.ticker}: ${signalCount} signals`);
      });
    } else {
      console.log('  (no rows)');
    }
  }

  // Check active assets count
  console.log('\n=== Checking assets ===\n');

  const { count: assetsCount, error: assetsError } = await supabase
    .from('assets')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  if (assetsError) {
    console.error('Error fetching assets count:', assetsError);
  } else {
    console.log(`Active assets: ${assetsCount}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
