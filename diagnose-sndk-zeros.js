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

async function diagnoseZeros() {
  console.log('\n' + '═'.repeat(80));
  console.log('SNDK: WHY ARE ALL WEEKLY/MONTHLY SIGNALS ZERO?');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get SNDK's backtest_signals to see the raw data structure
    const { data: backtestData } = await supabase
      .from('backtest_signals')
      .select('*')
      .eq('ticker', 'SNDK')
      .single();

    if (!backtestData) {
      console.log('❌ No backtest_signals data found');
      process.exit(0);
    }

    console.log('WEEKLY SIGNALS ANALYSIS:');
    console.log('─'.repeat(80));
    const weeklySignals = backtestData.signals_5y_weekly || [];
    console.log(`Total records: ${weeklySignals.length}`);

    if (weeklySignals.length > 0) {
      // Analyze the structure
      const firstSignal = weeklySignals[0];
      console.log(`\nFirst signal structure:`);
      console.log(`  Keys: ${Object.keys(firstSignal).join(', ')}`);
      console.log(`  finalMult: ${firstSignal.finalMult}`);
      console.log(`  signal: ${firstSignal.signal}`);
      console.log(`  date: ${firstSignal.date}`);

      // Check if ANY signal has non-zero multiplier
      const nonZero = weeklySignals.filter(s => (s.finalMult || 0) > 0);
      console.log(`\nSignals with finalMult > 0: ${nonZero.length}`);

      // Distribution of finalMult values
      const multipliers = weeklySignals.map(s => s.finalMult || 0).sort((a, b) => b - a);
      console.log(`\nMultiplier distribution (top 10):`);
      const unique = [...new Set(multipliers)].slice(0, 10);
      unique.forEach(m => {
        const count = multipliers.filter(x => x === m).length;
        console.log(`  ${m}: ${count} signals`);
      });

      // Check other fields that might affect multiplier
      console.log(`\nSample signals with all fields:`);
      weeklySignals.slice(0, 2).forEach((sig, i) => {
        console.log(`\n  Signal ${i}:`);
        Object.entries(sig).forEach(([k, v]) => {
          if (typeof v === 'object') {
            console.log(`    ${k}: [object]`);
          } else {
            console.log(`    ${k}: ${v}`);
          }
        });
      });
    }

    console.log('\n' + '─'.repeat(80));
    console.log('MONTHLY SIGNALS ANALYSIS:');
    console.log('─'.repeat(80));
    const monthlySignals = backtestData.signals_5y_monthly || [];
    console.log(`Total records: ${monthlySignals.length}`);

    const monthlyNonZero = monthlySignals.filter(s => (s.finalMult || 0) > 0);
    console.log(`Signals with finalMult > 0: ${monthlyNonZero.length}`);

    // Compare with AAPL to see if it's a data issue
    console.log('\n' + '─'.repeat(80));
    console.log('COMPARISON: AAPL weekly signals');
    console.log('─'.repeat(80));

    const { data: aaplData } = await supabase
      .from('backtest_signals')
      .select('signals_5y_weekly')
      .eq('ticker', 'AAPL')
      .single();

    if (aaplData && aaplData.signals_5y_weekly) {
      const aaplSignals = aaplData.signals_5y_weekly;
      console.log(`Total records: ${aaplSignals.length}`);
      const aaplNonZero = aaplSignals.filter(s => (s.finalMult || 0) > 0);
      console.log(`Signals with finalMult > 0: ${aaplNonZero.length}`);

      if (aaplNonZero.length > 0) {
        console.log(`Sample AAPL signal:`);
        const sample = aaplNonZero[0];
        console.log(`  Keys: ${Object.keys(sample).join(', ')}`);
        console.log(`  finalMult: ${sample.finalMult}`);
        console.log(`  signal: ${sample.signal}`);
      }
    }

    console.log('\n' + '═'.repeat(80) + '\n');

  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

diagnoseZeros();
