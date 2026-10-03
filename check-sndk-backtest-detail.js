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

async function checkSNDKBacktestDetail() {
  console.log('\n' + '═'.repeat(80));
  console.log('SNDK BACKTEST_SIGNALS DETAILED CHECK');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get the full backtest_signals record for SNDK
    const { data: backtestData, error } = await supabase
      .from('backtest_signals')
      .select('*')
      .eq('ticker', 'SNDK')
      .single();

    if (error) {
      console.log('❌ Error fetching backtest_signals:', error.message);
      process.exit(0);
    }

    if (!backtestData) {
      console.log('❌ SNDK not found in backtest_signals table');
      process.exit(0);
    }

    console.log('✓ SNDK found in backtest_signals\n');

    // Check the structure and data
    console.log('Record structure:');
    console.log('─'.repeat(80));
    console.log(`ticker: ${backtestData.ticker}`);
    console.log(`updated_at: ${backtestData.updated_at}`);
    console.log(`signals_5y_weekly: ${backtestData.signals_5y_weekly ? 'present' : 'NULL'}`);
    console.log(`signals_5y_monthly: ${backtestData.signals_5y_monthly ? 'present' : 'NULL'}`);
    console.log(`current_signal_5y_weekly: ${backtestData.current_signal_5y_weekly ? 'present' : 'NULL'}`);
    console.log(`current_signal_5y_monthly: ${backtestData.current_signal_5y_monthly ? 'present' : 'NULL'}`);

    // Check weekly signals
    console.log('\n' + '─'.repeat(80));
    console.log('WEEKLY SIGNALS:');
    console.log('─'.repeat(80));
    if (backtestData.signals_5y_weekly && Array.isArray(backtestData.signals_5y_weekly)) {
      console.log(`Count: ${backtestData.signals_5y_weekly.length}`);
      if (backtestData.signals_5y_weekly.length > 0) {
        console.log('Sample (first 3):');
        backtestData.signals_5y_weekly.slice(0, 3).forEach((sig, i) => {
          console.log(`  [${i}] date=${sig.date}, finalMult=${sig.finalMult}, signal=${sig.signal}`);
        });
      }
    } else {
      console.log('❌ signals_5y_weekly is NULL or not an array');
    }

    console.log(`Current signal: ${JSON.stringify(backtestData.current_signal_5y_weekly, null, 2)}`);

    // Check monthly signals
    console.log('\n' + '─'.repeat(80));
    console.log('MONTHLY SIGNALS:');
    console.log('─'.repeat(80));
    if (backtestData.signals_5y_monthly && Array.isArray(backtestData.signals_5y_monthly)) {
      console.log(`Count: ${backtestData.signals_5y_monthly.length}`);
      if (backtestData.signals_5y_monthly.length > 0) {
        console.log('Sample (first 3):');
        backtestData.signals_5y_monthly.slice(0, 3).forEach((sig, i) => {
          console.log(`  [${i}] date=${sig.date}, finalMult=${sig.finalMult}, signal=${sig.signal}`);
        });
      }
    } else {
      console.log('❌ signals_5y_monthly is NULL or not an array');
    }

    console.log(`Current signal: ${JSON.stringify(backtestData.current_signal_5y_monthly, null, 2)}`);

    // Check daily signals
    console.log('\n' + '─'.repeat(80));
    console.log('DAILY SIGNALS (from daily_signals table):');
    console.log('─'.repeat(80));
    const { data: dailySignal } = await supabase
      .from('daily_signals')
      .select('*')
      .eq('ticker', 'SNDK')
      .single();

    if (dailySignal) {
      console.log(`signals_1y: ${dailySignal.signals_1y ? 'present' : 'NULL'}`);
      if (dailySignal.signals_1y && Array.isArray(dailySignal.signals_1y)) {
        console.log(`  Count: ${dailySignal.signals_1y.length}`);
      }
      console.log(`current_signal: ${JSON.stringify(dailySignal.current_signal, null, 2)}`);
    } else {
      console.log('❌ No daily_signals record found');
    }

  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

checkSNDKBacktestDetail();
