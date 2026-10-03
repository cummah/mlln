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
  console.log('COMPREHENSIVE DAILY_PRICES SCAN');
  console.log('═'.repeat(80) + '\n');

  try {
    const { count: totalRows } = await supabase
      .from('daily_prices')
      .select('*', { count: 'exact' })
      .limit(0);

    console.log(`Total rows: ${totalRows?.toLocaleString()}`);
    console.log(`Fetching ALL unique tickers (may take a minute)...\n`);

    const tickerMap = {};
    let fetchedRows = 0;
    let pageSize = 10000;
    let offset = 0;

    // Fetch in chunks to get ALL data
    while (true) {
      console.log(`  Fetching rows ${offset} to ${offset + pageSize}...`);

      const { data, error } = await supabase
        .from('daily_prices')
        .select('ticker, date')
        .range(offset, offset + pageSize - 1);

      if (error || !data || data.length === 0) {
        console.log(`  Done - fetched all ${fetchedRows} rows\n`);
        break;
      }

      // Count rows per ticker
      data.forEach(row => {
        if (!tickerMap[row.ticker]) {
          tickerMap[row.ticker] = { count: 0, minDate: null, maxDate: null };
        }
        tickerMap[row.ticker].count++;

        if (!tickerMap[row.ticker].minDate || row.date < tickerMap[row.ticker].minDate) {
          tickerMap[row.ticker].minDate = row.date;
        }
        if (!tickerMap[row.ticker].maxDate || row.date > tickerMap[row.ticker].maxDate) {
          tickerMap[row.ticker].maxDate = row.date;
        }
      });

      fetchedRows += data.length;
      offset += pageSize;

      if (data.length < pageSize) break;
    }

    const tickers = Object.entries(tickerMap).sort((a, b) => b[1].count - a[1].count);

    console.log(`Found ${tickers.length} unique tickers:\n`);
    console.log('Ticker'.padEnd(12) + 'Rows'.padEnd(8) + 'From'.padEnd(12) + 'To'.padEnd(12) + 'Years');
    console.log('─'.repeat(80));

    let totalProcessed = 0;
    let complete = 0;

    tickers.forEach(([ticker, data]) => {
      const years = data.count >= 1000 ? '5+' : data.count >= 200 ? '1-4' : '<1';
      const status = data.count >= 1000 ? '✓' : '~';
      console.log(
        status + ' ' +
        ticker.padEnd(11) +
        data.count.toString().padEnd(7) +
        (data.minDate || 'N/A').padEnd(11) +
        (data.maxDate || 'N/A').padEnd(11) +
        years
      );
      totalProcessed += data.count;
      if (data.count >= 1000) complete++;
    });

    console.log('─'.repeat(80));
    console.log(`\nSUMMARY:`);
    console.log(`  Total rows verified: ${totalProcessed.toLocaleString()}`);
    console.log(`  Total tickers: ${tickers.length}`);
    console.log(`  Complete (≥1000 rows): ${complete}`);
    console.log(`  Coverage: ${complete}/${719} active assets (${((complete/719)*100).toFixed(1)}%)`);

    if (complete < 719) {
      console.log(`\n⚠️  STILL MISSING: ${719 - complete} tickers\n`);
    }

    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

fullScan();
