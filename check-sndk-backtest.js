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

async function checkSNDKBacktest() {
  console.log('\n' + '═'.repeat(80));
  console.log('SNDK BACKTEST_SIGNALS TABLE CHECK');
  console.log('═'.repeat(80) + '\n');

  try {
    // Check if SNDK exists in backtest_signals
    const { data: backtestData } = await supabase
      .from('backtest_signals')
      .select('*')
      .eq('ticker', 'SNDK')
      .single();

    if (!backtestData) {
      console.log('❌ SNDK not in backtest_signals table');
      console.log('\nThis is the issue: weekly/monthly signals require data in the backtest_signals table');
      console.log('The page will fall back to computing signals on-the-fly via API calls.');

      // Check how many tickers have backtest_signals data
      const { count: totalCount } = await supabase
        .from('backtest_signals')
        .select('*', { count: 'exact' });

      console.log(`\nTotal tickers with backtest_signals: ${totalCount}`);
    } else {
      console.log('✓ SNDK found in backtest_signals');
      console.log(`Updated at: ${backtestData.updated_at}`);
      console.log(`Has weekly signals: ${(backtestData.signals_5y_weekly || []).length > 0}`);
      console.log(`Has monthly signals: ${(backtestData.signals_5y_monthly || []).length > 0}`);
    }

  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

checkSNDKBacktest();
