const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.resolve('.env.local');
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

(async () => {
  try {
    console.log('Checking daily_prices and signals...\n');

    // Get latest dates from daily_prices
    const { data: pricesRaw } = await supabase
      .from('daily_prices')
      .select('date')
      .order('date', { ascending: false })
      .limit(50);

    const latestPricesDates = [...new Set(pricesRaw.map(r => r.date))];
    console.log('Latest 15 dates in daily_prices:');
    latestPricesDates.slice(0, 15).forEach(d => console.log('  ' + d));
    console.log('Latest price date:', latestPricesDates[0]);

    // Get latest signal dates
    const { data: signalsRaw } = await supabase
      .from('signals')
      .select('weekly_date, monthly_date')
      .order('weekly_date', { ascending: false })
      .limit(30);

    const weeklyDates = [...new Set(signalsRaw.filter(s => s.weekly_date).map(r => r.weekly_date))];
    const monthlyDates = [...new Set(signalsRaw.filter(s => s.monthly_date).map(r => r.monthly_date))];

    console.log('\nLatest weekly signal dates:');
    weeklyDates.slice(0, 10).forEach(d => console.log('  ' + d));
    console.log('Latest weekly signal date:', weeklyDates[0]);

    console.log('\nLatest monthly signal dates:');
    monthlyDates.slice(0, 10).forEach(d => console.log('  ' + d));
    console.log('Latest monthly signal date:', monthlyDates[0]);

    // Check for daily_signals
    const { data: dailySignals, error: dailyError } = await supabase
      .from('daily_signals')
      .select('ticker, date')
      .order('date', { ascending: false })
      .limit(30);

    if (!dailyError && dailySignals && dailySignals.length > 0) {
      const dailyDates = [...new Set(dailySignals.map(r => r.date))];
      console.log('\nLatest daily signal dates:');
      dailyDates.slice(0, 10).forEach(d => console.log('  ' + d));
      console.log('Latest daily signal date:', dailyDates[0]);
    } else {
      console.log('\nDaily signals table:', dailyError ? 'ERROR - ' + dailyError.message : 'No data');
    }

  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
})();
