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
  console.log('\n=== Checking Recent Updates ===\n');

  // Check when enrichment was last updated
  const { data: enrichmentRecent } = await supabase
    .from('monthly_signal_enrichment')
    .select('ticker, updated_at')
    .order('updated_at', { ascending: false })
    .limit(5);

  console.log('Most recent monthly_signal_enrichment updates:');
  enrichmentRecent?.forEach(row => {
    const date = new Date(row.updated_at);
    console.log(`  ${row.ticker}: ${date.toLocaleString()}`);
  });

  // Sample a ticker's signals from enrichment
  console.log('\n=== Sample: AAPL Monthly Signals ===\n');

  const { data: aaplEnrichment } = await supabase
    .from('monthly_signal_enrichment')
    .select('ticker, signals')
    .eq('ticker', 'AAPL')
    .limit(1);

  if (aaplEnrichment && aaplEnrichment[0]) {
    const signals = aaplEnrichment[0].signals || [];
    console.log(`AAPL monthly signals count: ${signals.length}`);
    if (signals.length > 0) {
      console.log('Most recent signal:');
      const mostRecent = signals[0];
      console.log(`  Date: ${mostRecent.date}`);
      console.log(`  FinalMult: ${mostRecent.finalMult}`);
      console.log(`  Performance: ${mostRecent.performance}%`);
    }
  } else {
    console.log('AAPL not found in enrichment table');
  }

  // Check for SPY
  console.log('\n=== Sample: SPY Monthly Signals ===\n');

  const { data: spyEnrichment } = await supabase
    .from('monthly_signal_enrichment')
    .select('ticker, signals')
    .eq('ticker', 'SPY')
    .limit(1);

  if (spyEnrichment && spyEnrichment[0]) {
    const signals = spyEnrichment[0].signals || [];
    console.log(`SPY monthly signals count: ${signals.length}`);
    if (signals.length > 0) {
      console.log('Most recent signals:');
      signals.slice(0, 3).forEach(sig => {
        console.log(`  ${sig.date}: mult=${sig.finalMult}, perf=${sig.performance}%`);
      });
    }
  } else {
    console.log('SPY not found in enrichment table');
  }

  // Count signals across all assets
  console.log('\n=== Signal Statistics ===\n');

  const { data: allEnrichment } = await supabase
    .from('monthly_signal_enrichment')
    .select('signals');

  let totalSignals = 0;
  let tickersWithSignals = 0;
  let maxSignalsPerTicker = 0;

  allEnrichment?.forEach(row => {
    const signals = row.signals || [];
    if (signals.length > 0) {
      tickersWithSignals++;
      totalSignals += signals.length;
      maxSignalsPerTicker = Math.max(maxSignalsPerTicker, signals.length);
    }
  });

  console.log(`Total tickers with monthly signals: ${tickersWithSignals}`);
  console.log(`Total monthly signals: ${totalSignals}`);
  console.log(`Average signals per ticker: ${(totalSignals / tickersWithSignals).toFixed(1)}`);
  console.log(`Max signals per ticker: ${maxSignalsPerTicker}`);

  // Check for signals generated TODAY
  console.log('\n=== Signals Generated Today (2026-09-03) ===\n');

  const { data: allEnrichmentFull } = await supabase
    .from('monthly_signal_enrichment')
    .select('ticker, signals');

  let todaysSignals = 0;
  const todaysTickers = [];

  allEnrichmentFull?.forEach(row => {
    const signals = row.signals || [];
    signals.forEach(sig => {
      if (sig.date && sig.date.startsWith('2026-09-03')) {
        todaysSignals++;
        if (!todaysTickers.includes(row.ticker)) {
          todaysTickers.push(row.ticker);
        }
      }
    });
  });

  console.log(`Signals with date 2026-09-03: ${todaysSignals}`);
  if (todaysTickers.length > 0) {
    console.log(`Tickers with today's signals: ${todaysTickers.join(', ')}`);
  } else {
    console.log('No signals generated today');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
