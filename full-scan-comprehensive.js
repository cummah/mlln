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

async function fullScan() {
  console.log('\n' + '═'.repeat(80));
  console.log('SCANNING ALL 937K ROWS');
  console.log('═'.repeat(80) + '\n');

  try {
    const tickerMap = {};
    const pageSize = 50000;
    let offset = 0;
    let pageNum = 0;

    while (true) {
      pageNum++;
      console.log(`Page ${pageNum}: rows ${offset.toLocaleString()}-${(offset+pageSize-1).toLocaleString()}...`);

      const { data, error } = await supabase
        .from('daily_prices')
        .select('ticker')
        .range(offset, offset + pageSize - 1)
        .order('ticker');

      if (error) {
        console.log(`  Error: ${error.message}`);
        break;
      }

      if (!data || data.length === 0) {
        console.log(`Complete!\n`);
        break;
      }

      data.forEach(row => {
        tickerMap[row.ticker] = (tickerMap[row.ticker] || 0) + 1;
      });

      console.log(`  Tickers found so far: ${Object.keys(tickerMap).length}\n`);
      offset += pageSize;

      if (data.length < pageSize) break;
    }

    const tickers = Object.entries(tickerMap).sort((a, b) => b[1] - a[1]);

    console.log('═'.repeat(80));
    console.log('RESULTS\n');
    console.log('Ticker'.padEnd(12) + 'Rows'.padEnd(10) + 'Status');
    console.log('─'.repeat(80));

    let complete = 0;
    tickers.forEach(([ticker, count]) => {
      const status = count >= 1000 ? '✓ Complete' : count >= 200 ? '~ Partial' : '✗ Incomplete';
      console.log(ticker.padEnd(12) + count.toString().padEnd(10) + status);
      if (count >= 1000) complete++;
    });

    console.log('─'.repeat(80));
    console.log(`\nTotal unique tickers: ${tickers.length}`);
    console.log(`Complete (≥1000 rows): ${complete}`);
    console.log(`Coverage: ${complete}/719 assets (${((complete/719)*100).toFixed(1)}%)\n`);
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

fullScan();
