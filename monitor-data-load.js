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

async function monitorDataLoad() {
  console.log('\n╔' + '═'.repeat(76) + '╗');
  console.log('║' + ' '.repeat(15) + 'SUPABASE DATA LOAD MONITOR' + ' '.repeat(35) + '║');
  console.log('╚' + '═'.repeat(76) + '╝\n');

  try {
    // Get daily_prices stats
    console.log('📊 DAILY_PRICES TABLE STATUS\n');

    const { count: totalPrices } = await supabase
      .from('daily_prices')
      .select('*', { count: 'exact' })
      .limit(0);

    const { data: allTickers } = await supabase
      .from('daily_prices')
      .select('ticker')
      .limit(100000);

    const uniqueTickers = new Set();
    if (allTickers) {
      allTickers.forEach(row => uniqueTickers.add(row.ticker));
    }

    console.log(`  Total rows: ${totalPrices?.toLocaleString() || 0}`);
    console.log(`  Unique tickers: ${uniqueTickers.size}\n`);

    // Get assets stats
    console.log('📋 ASSETS TABLE STATUS\n');

    const { data: assets } = await supabase
      .from('assets')
      .select('id', { count: 'exact' })
      .limit(0);

    const { data: activeAssets } = await supabase
      .from('assets')
      .select('id', { count: 'exact' })
      .eq('is_active', true)
      .limit(0);

    const totalAssets = assets?.length || 0;
    const activeCount = activeAssets?.length || 0;

    console.log(`  Total assets: ${totalAssets}`);
    console.log(`  Active assets: ${activeCount}`);
    console.log(`  Inactive/Delisted: ${totalAssets - activeCount}\n`);

    // Coverage analysis
    console.log('📈 COVERAGE ANALYSIS\n');

    const coverage = {
      complete: 0,
      partial: 0,
      empty: 0,
    };

    const { data: allAssetsList } = await supabase
      .from('assets')
      .select('ticker, is_active')
      .limit(1000);

    if (allAssetsList) {
      for (const asset of allAssetsList) {
        if (uniqueTickers.has(asset.ticker)) {
          const { count } = await supabase
            .from('daily_prices')
            .select('*', { count: 'exact' })
            .eq('ticker', asset.ticker)
            .limit(0);

          if (count >= 1000) {
            coverage.complete++;
          } else if (count > 0) {
            coverage.partial++;
          }
        } else {
          coverage.empty++;
        }
      }
    }

    console.log(`  ✓ Complete (≥1000 rows): ${coverage.complete}`);
    console.log(`  ~ Partial (1-999 rows): ${coverage.partial}`);
    console.log(`  ✗ Empty (0 rows): ${coverage.empty}\n`);

    // Backtest summary status
    console.log('💾 BACKTEST_SUMMARY TABLE STATUS\n');

    const { count: summaryCount } = await supabase
      .from('backtest_summary')
      .select('*', { count: 'exact' })
      .limit(0);

    const expectedSummaryRows = activeCount - 251; // Excluding inactive
    const summaryProgress = summaryCount ? Math.round((summaryCount / expectedSummaryRows) * 100) : 0;

    console.log(`  Rows: ${summaryCount || 0}`);
    console.log(`  Expected: ~${expectedSummaryRows}`);
    console.log(`  Progress: ${summaryProgress}%\n`);

    // Data quality metrics
    console.log('✅ DATA QUALITY METRICS\n');

    // Check date ranges for a few tickers with data
    const sampleTickers = Array.from(uniqueTickers).slice(0, 5);

    for (const ticker of sampleTickers) {
      const { data: oldest } = await supabase
        .from('daily_prices')
        .select('date')
        .eq('ticker', ticker)
        .order('date', { ascending: true })
        .limit(1);

      const { data: newest } = await supabase
        .from('daily_prices')
        .select('date')
        .eq('ticker', ticker)
        .order('date', { ascending: false })
        .limit(1);

      const oldestDate = oldest?.[0]?.date || 'N/A';
      const newestDate = newest?.[0]?.date || 'N/A';

      const hasFullRange = oldestDate <= '2021-04-28' && newestDate >= '2026-04-27';
      const hasStatus = hasFullRange ? '✓' : '⚠';

      console.log(`  ${hasStatus} ${ticker.padEnd(10)} from ${oldestDate} to ${newestDate}`);
    }

    // Overall status
    console.log('\n' + '═'.repeat(78) + '\n');

    const completionPercentage = activeCount > 0
      ? Math.round((uniqueTickers.size / activeCount) * 100)
      : 0;

    console.log('🎯 OVERALL STATUS\n');
    console.log(`  Price Data: ${completionPercentage}% complete (${uniqueTickers.size}/${activeCount} tickers)`);
    console.log(`  Summary Cache: ${summaryProgress}% complete (${summaryCount || 0}/${expectedSummaryRows} rows)`);

    if (completionPercentage >= 90 && summaryProgress >= 90) {
      console.log('\n  ✅ DATA LOAD COMPLETE - Assets page should be fully functional');
    } else if (completionPercentage >= 50 && summaryProgress >= 50) {
      console.log('\n  🔄 DATA LOAD IN PROGRESS - Still updating, check again in a few minutes');
    } else {
      console.log('\n  ⏳ DATA LOAD STARTING - Run the following commands:');
      console.log('     npm run backfill:missing');
      console.log('     npm run compute:summary');
    }

    console.log('\n' + '═'.repeat(78) + '\n');

  } catch (error) {
    console.error('Error monitoring data:', error);
  }

  process.exit(0);
}

monitorDataLoad();
