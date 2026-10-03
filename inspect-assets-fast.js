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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function inspectAssets() {
  console.log('='.repeat(80));
  console.log('ASSET DATA INSPECTION (FAST)');
  console.log('='.repeat(80));

  try {
    // 1. Get all assets
    console.log('\n1. Fetching all assets...\n');

    let allAssets = [];
    let pageNum = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('assets')
        .select('id, ticker, name, sector, is_active')
        .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1);

      if (error) {
        console.log(`Error fetching page ${pageNum}:`, error);
        break;
      }

      if (!data || data.length === 0) break;
      allAssets = allAssets.concat(data);
      console.log(`  Loaded page ${pageNum + 1}: ${data.length} assets (total: ${allAssets.length})`);
      pageNum++;
    }

    console.log(`\nTotal Assets: ${allAssets.length}`);
    console.log(`Active Assets: ${allAssets.filter(a => a.is_active).length}`);
    console.log(`Inactive Assets: ${allAssets.filter(a => !a.is_active).length}`);

    // 2. Get all distinct tickers from daily_prices
    console.log('\n2. Checking which assets have price data...\n');

    const { data: tickersWithData, error: tickerError } = await supabase
      .from('daily_prices')
      .select('ticker')
      .order('ticker');

    let uniqueTickers = new Set();
    if (tickersWithData) {
      tickersWithData.forEach(row => uniqueTickers.add(row.ticker));
    }

    console.log(`Unique tickers with data: ${uniqueTickers.size}`);

    // 3. Identify which assets have data vs no data
    console.log('\n3. Asset Data Status\n');

    const withData = allAssets.filter(a => uniqueTickers.has(a.ticker));
    const noData = allAssets.filter(a => !uniqueTickers.has(a.ticker));

    console.log(`Assets with data: ${withData.length}`);
    console.log(`Assets without data: ${noData.length}`);

    // 4. Check the date range for some assets with data
    console.log('\n4. Sample Data Coverage Check\n');

    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const fiveYearsAgoStr = fiveYearsAgo.toISOString().split('T')[0];

    console.log(`Data range threshold: ${fiveYearsAgoStr} (5 years ago)\n`);

    // Get min and max dates from daily_prices
    const { data: dateRange, error: dateError } = await supabase
      .rpc('get_price_date_ranges');

    if (dateError) {
      console.log('RPC function not available, using direct query...\n');

      // Fallback: sample some tickers
      const sampleTickers = Array.from(uniqueTickers).slice(0, 10);

      for (const ticker of sampleTickers) {
        const { data: minMax } = await supabase
          .from('daily_prices')
          .select('date')
          .eq('ticker', ticker)
          .order('date', { ascending: true })
          .limit(1);

        const { data: latest } = await supabase
          .from('daily_prices')
          .select('date')
          .eq('ticker', ticker)
          .order('date', { ascending: false })
          .limit(1);

        const firstDate = minMax && minMax.length > 0 ? minMax[0].date : null;
        const lastDate = latest && latest.length > 0 ? latest[0].date : null;
        const has5Years = lastDate && lastDate >= fiveYearsAgoStr;

        console.log(`  ${ticker.padEnd(10)} - from ${firstDate} to ${lastDate} ${has5Years ? '✓' : '✗'}`);
      }
    }

    // 5. Show assets without data
    console.log('\n5. Assets WITHOUT Data\n');

    if (noData.length > 0 && noData.length <= 50) {
      console.log(`All ${noData.length} assets without data:`);
      noData.forEach(a => {
        console.log(`  ✗ ${a.ticker.padEnd(10)} - ${a.name.substring(0, 40)}`);
      });
    } else if (noData.length > 50) {
      console.log(`First 50 of ${noData.length} assets without data:`);
      noData.slice(0, 50).forEach(a => {
        console.log(`  ✗ ${a.ticker.padEnd(10)} - ${a.name.substring(0, 40)}`);
      });
      console.log(`\n  ... and ${noData.length - 50} more assets without data`);
    } else {
      console.log('(All assets have data!)');
    }

    // 6. Show inactive assets
    console.log('\n6. Inactive Assets\n');

    const inactiveWithData = withData.filter(a => !a.is_active);
    const inactiveNoData = noData.filter(a => !a.is_active);

    console.log(`Inactive assets with data: ${inactiveWithData.length}`);
    if (inactiveWithData.length > 0 && inactiveWithData.length <= 20) {
      inactiveWithData.forEach(a => {
        console.log(`  ${a.ticker.padEnd(10)} - ${a.name}`);
      });
    }

    console.log(`\nInactive assets without data: ${inactiveNoData.length}`);
    if (inactiveNoData.length > 0 && inactiveNoData.length <= 20) {
      inactiveNoData.forEach(a => {
        console.log(`  ${a.ticker.padEnd(10)} - ${a.name}`);
      });
    }

  } catch (error) {
    console.error('Error during inspection:', error);
  }

  console.log('\n' + '='.repeat(80));
  process.exit(0);
}

inspectAssets();
