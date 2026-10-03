const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function compareSignalCoverage() {
  console.log('\n' + '═'.repeat(80));
  console.log('SIGNAL COVERAGE COMPARISON: SNDK vs AAPL (working ticker)');
  console.log('═'.repeat(80) + '\n');

  const tickers = ['SNDK', 'AAPL'];

  for (const ticker of tickers) {
    console.log(`\n${ticker}:`);
    console.log('─'.repeat(40));

    // Price data
    const { count: priceCount } = await supabase
      .from('daily_prices')
      .select('*', { count: 'exact' })
      .eq('ticker', ticker);

    // Signal counts
    const { count: dailyCount } = await supabase
      .from('daily_signals')
      .select('*', { count: 'exact' })
      .eq('ticker', ticker);

    const { count: weeklyCount } = await supabase
      .from('weekly_signals')
      .select('*', { count: 'exact' })
      .eq('ticker', ticker);

    const { count: monthlyCount } = await supabase
      .from('monthly_signals')
      .select('*', { count: 'exact' })
      .eq('ticker', ticker);

    console.log(`Prices:        ${priceCount || 0}`);
    console.log(`Daily signals: ${dailyCount || 0}`);
    console.log(`Weekly signals: ${weeklyCount || 0}`);
    console.log(`Monthly signals: ${monthlyCount || 0}`);

    // Get a sample signal with actual data
    const { data: sampleDaily } = await supabase
      .from('daily_signals')
      .select('*')
      .eq('ticker', ticker)
      .not('signal', 'is', null)
      .limit(1);

    if (sampleDaily && sampleDaily.length > 0) {
      console.log(`\nSample daily signal (${ticker}):`);
      const sig = sampleDaily[0];
      console.log(`  Date: ${sig.date}`);
      console.log(`  Signal: ${sig.signal}`);
      console.log(`  Strength: ${sig.strength}`);
      console.log(`  Amount: ${sig.amount}`);
    } else {
      console.log(`\nNo daily signals with data found`);
    }
  }

  console.log('\n' + '═'.repeat(80) + '\n');

  process.exit(0);
}

compareSignalCoverage();
