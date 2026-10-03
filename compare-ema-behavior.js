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

async function compareEMA() {
  console.log('\n' + '═'.repeat(80));
  console.log('EMA BEHAVIOR: SNDK vs AAPL');
  console.log('═'.repeat(80) + '\n');

  const tickers = ['SNDK', 'AAPL'];

  for (const ticker of tickers) {
    console.log(`\n${ticker}:`);
    console.log('─'.repeat(80));

    const { data: backtestData } = await supabase
      .from('backtest_signals')
      .select('signals_5y_weekly')
      .eq('ticker', ticker)
      .single();

    if (!backtestData || !backtestData.signals_5y_weekly) {
      console.log('No backtest data');
      continue;
    }

    const signals = backtestData.signals_5y_weekly;

    // Analyze emaMult distribution
    const emuMults = signals.map(s => s.emaMult || 0);
    const withEMA = emuMults.filter(m => m > 0).length;
    const withoutEMA = emuMults.filter(m => m === 0).length;

    console.log(`Total signals: ${signals.length}`);
    console.log(`With emaMult > 0: ${withEMA}`);
    console.log(`With emaMult = 0: ${withoutEMA}`);

    if (emuMults.length > 0) {
      console.log(`\nEMA Multiplier Stats:`);
      console.log(`  Min: ${Math.min(...emuMults).toFixed(3)}`);
      console.log(`  Max: ${Math.max(...emuMults).toFixed(3)}`);
      console.log(`  Avg: ${(emuMults.reduce((a,b) => a+b, 0) / emuMults.length).toFixed(3)}`);
    }

    // Check rsiMult distribution
    const rsiMults = signals.map(s => s.rsiMult || 0);
    const withRSI = rsiMults.filter(m => m > 0).length;
    console.log(`\nRSI Multiplier Stats:`);
    console.log(`  With rsiMult > 0: ${withRSI}`);
    console.log(`  Min: ${Math.min(...rsiMults).toFixed(3)}`);
    console.log(`  Max: ${Math.max(...rsiMults).toFixed(3)}`);

    // Check which is blocking signals
    const blockedByEMA = signals.filter(s => (s.emaMult || 0) === 0 && (s.rsiMult || 0) > 0).length;
    const blockedByRSI = signals.filter(s => (s.rsiMult || 0) === 0 && (s.emaMult || 0) > 0).length;
    const blockedByBoth = signals.filter(s => (s.emaMult || 0) === 0 && (s.rsiMult || 0) === 0).length;

    console.log(`\nSignal Blocking Analysis:`);
    console.log(`  Blocked by EMA (RSI ok, EMA=0): ${blockedByEMA}`);
    console.log(`  Blocked by RSI (EMA ok, RSI=0): ${blockedByRSI}`);
    console.log(`  Blocked by both: ${blockedByBoth}`);

    // Show a few actual signals
    console.log(`\nSample signals (first 3):`);
    signals.slice(0, 3).forEach((sig, i) => {
      console.log(`  [${i}] date=${sig.date} emaMult=${sig.emaMult?.toFixed(2)} rsiMult=${sig.rsiMult?.toFixed(2)} finalMult=${sig.finalMult?.toFixed(2)}`);
    });

    // Find signals that would work if EMA wasn't blocking
    const couldWork = signals.filter(s => (s.rsiMult || 0) > 0 && (s.emaMult || 0) === 0);
    if (couldWork.length > 0) {
      console.log(`\nSignals blocked only by EMA (examples):`);
      couldWork.slice(0, 3).forEach((sig, i) => {
        console.log(`  date=${sig.date} emaMult=0 rsiMult=${sig.rsiMult?.toFixed(2)} → would be ${(sig.rsiMult * 1).toFixed(2)}x`);
      });
    }
  }

  console.log('\n' + '═'.repeat(80) + '\n');
  process.exit(0);
}

compareEMA();
