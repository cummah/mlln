const { createClient } = require('@supabase/supabase-js');
const YahooFinance = require('yahoo-finance2').default;
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

const yf = new YahooFinance({
  suppressNotices: ['ripHistorical'],
});

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testYahooFinanceAPI() {
  console.log('\n' + '═'.repeat(80));
  console.log('YAHOO FINANCE API DIAGNOSTICS');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get list of assets missing data
    const { data: assets } = await supabase
      .from('assets')
      .select('ticker, name')
      .eq('is_active', true)
      .limit(100);

    if (!assets) {
      console.log('Could not fetch assets');
      process.exit(1);
    }

    // Get tickers that already have data
    const { data: priceData } = await supabase
      .from('daily_prices')
      .select('ticker')
      .limit(100000);

    const tickersWithData = new Set(priceData?.map(p => p.ticker) || []);

    // Find assets without data
    const tickersNeedingData = assets.filter(a => !tickersWithData.has(a.ticker));

    console.log(`Testing API with ${Math.min(10, tickersNeedingData.length)} sample tickers...\n`);

    let successCount = 0;
    let failureCount = 0;
    const results = [];

    for (let i = 0; i < Math.min(10, tickersNeedingData.length); i++) {
      const ticker = tickersNeedingData[i].ticker;
      console.log(`Testing ${ticker}...`);

      try {
        const fromDate = new Date('2021-01-01');
        const toDate = new Date();

        const data = await yf.historical(ticker, {
          period1: fromDate,
          period2: toDate,
          interval: '1d',
        });

        if (data && data.length > 0) {
          console.log(`  ✓ Success: ${data.length} rows\n`);
          successCount++;
          results.push({ ticker, status: 'success', rows: data.length });
        } else {
          console.log(`  ✗ No data returned\n`);
          failureCount++;
          results.push({ ticker, status: 'no-data', rows: 0 });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.log(`  ✗ Error: ${errorMsg}\n`);
        failureCount++;
        results.push({ ticker, status: 'error', error: errorMsg });
      }

      await delay(300); // Conservative delay
    }

    console.log('═'.repeat(80));
    console.log('RESULTS:\n');
    console.log(`Success: ${successCount}/10`);
    console.log(`Failures: ${failureCount}/10\n`);

    if (successCount > 0) {
      console.log('✓ API is working - backfill can proceed');
    } else if (failureCount === 10) {
      console.log('✗ API is failing - likely rate limiting or authentication issue');
      console.log('  Possible fixes:');
      console.log('  1. Check Yahoo Finance API status');
      console.log('  2. Increase delay between requests (try 500ms instead of 150ms)');
      console.log('  3. Check if your IP is being rate limited');
      console.log('  4. Some tickers may be invalid/delisted');
    }

    console.log('\n' + '═'.repeat(80) + '\n');

  } catch (error) {
    console.error('Fatal error:', error);
  }

  process.exit(0);
}

testYahooFinanceAPI();
