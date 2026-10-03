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
  console.log('\n=== Checking Latest Prices ===\n');

  // Get the overall max date
  const { data: maxDateData } = await supabase
    .from('daily_prices')
    .select('date')
    .order('date', { ascending: false })
    .limit(1);

  if (maxDateData && maxDateData.length > 0) {
    console.log(`Latest date in daily_prices: ${maxDateData[0].date}`);
  }

  // Check a sample ticker
  const { data: aaplDates } = await supabase
    .from('daily_prices')
    .select('date')
    .eq('ticker', 'AAPL')
    .order('date', { ascending: false })
    .limit(5);

  console.log('\nAAPL latest 5 dates:');
  aaplDates?.forEach(row => console.log(`  ${row.date}`));

  // Check SPY
  const { data: spyDates } = await supabase
    .from('daily_prices')
    .select('date')
    .eq('ticker', 'SPY')
    .order('date', { ascending: false })
    .limit(5);

  console.log('\nSPY latest 5 dates:');
  spyDates?.forEach(row => console.log(`  ${row.date}`));

  // Check count by month
  const { data: allPrices } = await supabase
    .from('daily_prices')
    .select('date')
    .gte('date', '2026-08-01')
    .order('date', { ascending: false });

  const datesByMonth = {};
  allPrices?.forEach(row => {
    const month = row.date.substring(0, 7);
    datesByMonth[month] = (datesByMonth[month] || 0) + 1;
  });

  console.log('\nRow count by month (Aug onwards):');
  Object.entries(datesByMonth)
    .sort(([a], [b]) => b.localeCompare(a))
    .forEach(([month, count]) => {
      console.log(`  ${month}: ${count} rows`);
    });
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
