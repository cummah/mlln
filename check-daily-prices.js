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

async function checkPrices() {
  console.log('\n' + '═'.repeat(80));
  console.log('DAILY_PRICES TABLE DETAILED ANALYSIS');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get total count
    const { count: totalRows } = await supabase
      .from('daily_prices')
      .select('*', { count: 'exact' })
      .limit(0);

    console.log(`Total rows in daily_prices: ${totalRows?.toLocaleString()}\n`);

    // Get all unique tickers
    console.log('Fetching all unique tickers with data...');
    let allTickers = [];
    let pageNum = 0;

    while (true) {
      const { data } = await supabase
        .from('daily_prices')
        .select('ticker')
        .limit(100000)
        .range(pageNum * 100000, (pageNum + 1) * 100000 - 1);

      if (!data || data.length === 0) break;
      allTickers = allTickers.concat(data);
      pageNum++;
    }

    const uniqueTickers = [...new Set(allTickers.map(t => t.ticker))].sort();
    console.log(`Unique tickers: ${uniqueTickers.length}\n`);

    console.log('All tickers with data:');
    console.log('─'.repeat(80));

    // Group by count
    const tickerStats = {};
    for (const ticker of uniqueTickers) {
      const { count } = await supabase
        .from('daily_prices')
        .select('*', { count: 'exact' })
        .eq('ticker', ticker)
        .limit(0);

      tickerStats[ticker] = count || 0;
    }

    // Sort by count descending
    const sorted = Object.entries(tickerStats).sort((a, b) => b[1] - a[1]);

    sorted.forEach(([ticker, count]) => {
      const status = count >= 1000 ? '✓' : count >= 200 ? '~' : '✗';
      console.log(`${status} ${ticker.padEnd(10)} - ${count.toLocaleString()} rows`);
    });

    console.log('\n' + '─'.repeat(80));
    console.log('\nSUMMARY:');
    const complete = sorted.filter(([_, count]) => count >= 1000).length;
    const partial = sorted.filter(([_, count]) => count >= 200 && count < 1000).length;
    const incomplete = sorted.filter(([_, count]) => count < 200).length;

    console.log(`  Complete (≥1000 rows):   ${complete}`);
    console.log(`  Partial (200-999 rows):  ${partial}`);
    console.log(`  Incomplete (<200 rows):  ${incomplete}`);

    console.log('\n' + '═'.repeat(80) + '\n');

  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

checkPrices();
