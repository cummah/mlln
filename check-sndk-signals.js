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

async function checkSNDKSignals() {
  console.log('\n' + '═'.repeat(80));
  console.log('SNDK SIGNAL DETAILS');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get the single daily signal
    console.log('DAILY SIGNAL:');
    console.log('─'.repeat(80));
    const { data: dailySignal } = await supabase
      .from('daily_signals')
      .select('*')
      .eq('ticker', 'SNDK');

    if (dailySignal && dailySignal.length > 0) {
      dailySignal.forEach(sig => {
        console.log(`Date: ${sig.date}`);
        console.log(`Signal: ${sig.signal}`);
        console.log(`Strength: ${sig.strength}`);
        console.log(`Amount: ${sig.amount}`);
        console.log(`Created: ${sig.created_at}`);
      });
    }

    // Check latest price for SNDK to understand data state
    console.log('\n' + '─'.repeat(80));
    console.log('LATEST PRICES FOR SNDK:');
    console.log('─'.repeat(80));
    const { data: prices } = await supabase
      .from('daily_prices')
      .select('*')
      .eq('ticker', 'SNDK')
      .order('date', { ascending: false })
      .limit(5);

    if (prices) {
      prices.forEach(p => {
        console.log(`${p.date}: open=${p.open}, high=${p.high}, low=${p.low}, close=${p.close}`);
      });
    }

    // Check for recent weekly/monthly signal attempts
    console.log('\n' + '─'.repeat(80));
    console.log('CHECKING ALL SIGNAL TABLES FOR SNDK:');
    console.log('─'.repeat(80));

    const tables = ['daily_signals', 'weekly_signals', 'monthly_signals'];
    for (const table of tables) {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact' })
        .eq('ticker', 'SNDK');
      console.log(`${table}: ${count || 0} records`);
    }

    // Check if signals_summary has data (if that table exists)
    console.log('\n' + '─'.repeat(80));
    console.log('CHECKING SIGNALS_SUMMARY:');
    console.log('─'.repeat(80));

    try {
      const { data: summaryData } = await supabase
        .from('signals_summary')
        .select('*')
        .eq('ticker', 'SNDK');

      if (summaryData && summaryData.length > 0) {
        console.log(`✓ Found ${summaryData.length} summary record(s)`);
        summaryData.forEach(summary => {
          console.log(`Updated at: ${summary.updated_at}`);
          console.log(`Conviction: ${summary.conviction_score}`);
        });
      } else {
        console.log('❌ No signals_summary data');
      }
    } catch (e) {
      console.log('signals_summary table may not exist or is not accessible');
    }

  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

checkSNDKSignals();
