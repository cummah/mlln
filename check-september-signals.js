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
  console.log('\n=== Checking September Signals After compute:summary ===\n');

  // Check sample tickers
  const tickers = ['AAPL', 'SPY', 'QQQ', 'VTI'];

  for (const ticker of tickers) {
    const { data } = await supabase
      .from('backtest_signals')
      .select('signals_5y_monthly, updated_at')
      .eq('ticker', ticker)
      .single();

    if (!data) {
      console.log(`${ticker}: NOT FOUND`);
      continue;
    }

    const signals = data.signals_5y_monthly || [];
    const updated = new Date(data.updated_at).toLocaleString();
    console.log(`${ticker}: updated ${updated}`);
    console.log(`  Total monthly signals: ${signals.length}`);

    // Find latest signal
    if (signals.length > 0) {
      const latest = signals[signals.length - 1];
      console.log(`  Latest signal: ${latest.date} (mult=${latest.finalMult}, skipped=${latest.skipped || false})`);
    }

    // Check for September
    const septemberSignals = signals.filter(s => s.date && s.date.startsWith('2026-09'));
    if (septemberSignals.length > 0) {
      console.log(`  September signals: ${septemberSignals.length}`);
      septemberSignals.forEach(s => {
        console.log(`    ${s.date}: mult=${s.finalMult}, skipped=${s.skipped || false}`);
      });
    } else {
      console.log(`  September signals: NONE`);
    }

    console.log();
  }

  // Check if ANY ticker has September signals
  console.log('\n=== Overall Statistics ===\n');

  const { data: allBacktests } = await supabase
    .from('backtest_signals')
    .select('ticker, signals_5y_monthly');

  let totalSeptemberSignals = 0;
  let tickersWithSeptemberSignals = new Set();
  let latestSignalDate = null;

  allBacktests?.forEach(row => {
    const signals = row.signals_5y_monthly || [];
    if (signals.length > 0) {
      const latest = signals[signals.length - 1];
      if (!latestSignalDate || latest.date > latestSignalDate) {
        latestSignalDate = latest.date;
      }
    }

    const septSignals = signals.filter(s => s.date && s.date.startsWith('2026-09'));
    if (septSignals.length > 0) {
      totalSeptemberSignals += septSignals.length;
      tickersWithSeptemberSignals.add(row.ticker);
    }
  });

  console.log(`Total September monthly signals: ${totalSeptemberSignals}`);
  console.log(`Tickers with September signals: ${tickersWithSeptemberSignals.size}`);
  console.log(`Latest signal date overall: ${latestSignalDate}`);

  // Check monthly_signal_enrichment
  console.log('\n=== Checking monthly_signal_enrichment ===\n');

  const { data: enrichedSample } = await supabase
    .from('monthly_signal_enrichment')
    .select('ticker, updated_at')
    .order('updated_at', { ascending: false })
    .limit(3);

  console.log('Most recent enrichment updates:');
  enrichedSample?.forEach(row => {
    const date = new Date(row.updated_at).toLocaleString();
    console.log(`  ${row.ticker}: ${date}`);
  });
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
