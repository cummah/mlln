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

async function checkDailyEMA() {
  console.log('\n' + '═'.repeat(80));
  console.log('SNDK: DAILY SIGNALS vs WEEKLY/MONTHLY EMA DIFFERENCE');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get SNDK's daily signals
    const { data: dailyData } = await supabase
      .from('daily_signals')
      .select('signals_1y')
      .eq('ticker', 'SNDK')
      .single();

    if (dailyData && dailyData.signals_1y) {
      const dailySignals = dailyData.signals_1y;
      console.log('DAILY SIGNALS:');
      console.log('─'.repeat(80));
      console.log(`Total: ${dailySignals.length}`);

      const withMult = dailySignals.filter(s => (s.finalMult || 0) > 0);
      console.log(`With finalMult > 0: ${withMult.length}`);

      if (dailySignals.length > 0) {
        console.log(`\nFirst daily signal:`);
        const first = dailySignals[0];
        console.log(`  Keys: ${Object.keys(first).join(', ')}`);
        console.log(`  finalMult: ${first.finalMult}`);
        console.log(`  emaMult: ${first.emaMult}`);
        console.log(`  rsiMult: ${first.rsiMult}`);
        console.log(`  date: ${first.date}`);
      }

      // Check how many daily signals have non-zero emaMult
      const withEMA = dailySignals.filter(s => (s.emaMult || 0) > 0).length;
      console.log(`\nDaily signals with emaMult > 0: ${withEMA}`);

      // Find dates when daily signals fired
      console.log(`\nDaily signals with finalMult > 0 (first 5):`);
      withMult.slice(0, 5).forEach((sig, i) => {
        console.log(`  [${i}] date=${sig.date}, finalMult=${sig.finalMult}, emaMult=${sig.emaMult}`);
      });
    }

    // Get the current signal structure to see what's different
    console.log('\n' + '─'.repeat(80));
    console.log('CURRENT SIGNALS (real-time):');
    console.log('─'.repeat(80));

    const { data: backtestData } = await supabase
      .from('backtest_signals')
      .select('current_signal_5y_weekly, current_signal_5y_monthly')
      .eq('ticker', 'SNDK')
      .single();

    if (backtestData) {
      console.log('\nCurrent Weekly Signal:');
      const weekly = backtestData.current_signal_5y_weekly;
      if (weekly) {
        console.log(`  emaMult: ${weekly.emaMultiplier}`);
        console.log(`  rsiMult: ${weekly.rsiMultiplier}`);
        console.log(`  vixMult: ${weekly.vixMultiplier}`);
        console.log(`  finalMult: ${weekly.finalMultiplier}`);
      }

      console.log('\nCurrent Monthly Signal:');
      const monthly = backtestData.current_signal_5y_monthly;
      if (monthly) {
        console.log(`  emaMult: ${monthly.emaMultiplier}`);
        console.log(`  rsiMult: ${monthly.rsiMultiplier}`);
        console.log(`  vixMult: ${monthly.vixMultiplier}`);
        console.log(`  finalMult: ${monthly.finalMultiplier}`);
      }
    }

    const { data: dailySignalData } = await supabase
      .from('daily_signals')
      .select('current_signal')
      .eq('ticker', 'SNDK')
      .single();

    if (dailySignalData && dailySignalData.current_signal) {
      console.log('\nCurrent Daily Signal:');
      const daily = dailySignalData.current_signal;
      console.log(`  emaMult: ${daily.emaMultiplier}`);
      console.log(`  rsiMult: ${daily.rsiMultiplier}`);
      console.log(`  vixMult: ${daily.vixMultiplier}`);
      console.log(`  finalMult: ${daily.finalMultiplier}`);
    }

    console.log('\n' + '═'.repeat(80) + '\n');

  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

checkDailyEMA();
