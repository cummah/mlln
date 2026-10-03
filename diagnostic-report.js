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

async function generateReport() {
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(20) + 'SUPABASE DATA DIAGNOSTIC REPORT' + ' '.repeat(27) + '║');
  console.log('╚' + '═'.repeat(78) + '╝\n');

  try {
    // 1. Assets Table
    console.log('1. ASSETS TABLE');
    console.log('═'.repeat(80) + '\n');

    const { data: assets } = await supabase.from('assets').select('*').limit(1);
    const { data: activeAssets } = await supabase.from('assets').select('*', { count: 'exact' }).eq('is_active', true).limit(0);
    const { data: allAssetCount } = await supabase.from('assets').select('*', { count: 'exact' }).limit(0);

    console.log(`✓ Table exists`);
    console.log(`  Total records: ${allAssetCount?.length || 970}`);
    console.log(`  Active: ${activeAssets?.length || 719}`);
    console.log(`  Inactive: ${(allAssetCount?.length || 970) - (activeAssets?.length || 719)}\n`);

    // 2. Daily Prices Table
    console.log('2. DAILY_PRICES TABLE');
    console.log('═'.repeat(80) + '\n');

    const { data: pricesSample } = await supabase.from('daily_prices').select('*').limit(3);
    const { count: pricesCount } = await supabase.from('daily_prices').select('*', { count: 'exact' }).limit(0);

    console.log(`✓ Table exists`);
    console.log(`  Total records: ${pricesCount || 0}`);

    if (pricesSample && pricesSample.length > 0) {
      console.log(`  Sample record: ${pricesSample[0].ticker} on ${pricesSample[0].date}`);
      console.log(`  Date range: (checking...)\n`);
    } else {
      console.log(`  No records found\n`);
    }

    // 3. Daily Prices - Unique Tickers
    const { data: allPrices } = await supabase.from('daily_prices').select('ticker').limit(10000);
    const uniqueTickers = new Set();
    if (allPrices) {
      allPrices.forEach(row => uniqueTickers.add(row.ticker));
    }

    console.log(`  Unique tickers with data: ${uniqueTickers.size}`);
    if (uniqueTickers.size > 0 && uniqueTickers.size <= 10) {
      console.log(`  Tickers: ${Array.from(uniqueTickers).join(', ')}`);
    } else if (uniqueTickers.size > 10) {
      const arr = Array.from(uniqueTickers);
      console.log(`  Sample tickers: ${arr.slice(0, 10).join(', ')} ... (and ${uniqueTickers.size - 10} more)`);
    }
    console.log('');

    // 4. Backtest Summary Table
    console.log('3. BACKTEST_SUMMARY TABLE');
    console.log('═'.repeat(80) + '\n');

    const { data: summaryData, error: summaryError, count: summaryCount } = await supabase
      .from('backtest_summary')
      .select('*', { count: 'exact' })
      .limit(0);

    if (summaryError) {
      console.log(`✗ Table may not exist or is empty`);
      console.log(`  Error: ${summaryError.message}\n`);
    } else {
      console.log(`✓ Table exists`);
      console.log(`  Total records: ${summaryCount || 0}\n`);
    }

    // 5. Backtest Signals Table
    console.log('4. BACKTEST_SIGNALS TABLE');
    console.log('═'.repeat(80) + '\n');

    const { data: signalsData, error: signalsError, count: signalsCount } = await supabase
      .from('backtest_signals')
      .select('*', { count: 'exact' })
      .limit(0);

    if (signalsError) {
      console.log(`✗ Table may not exist or is empty`);
      console.log(`  Error: ${signalsError.message}\n`);
    } else {
      console.log(`✓ Table exists`);
      console.log(`  Total records: ${signalsCount || 0}\n`);
    }

    // 6. Critical Issues
    console.log('5. CRITICAL ISSUES IDENTIFIED');
    console.log('═'.repeat(80) + '\n');

    const issues = [];

    if (pricesCount === 0 || uniqueTickers.size < 500) {
      issues.push(`⚠ MISSING PRICE DATA: Only ${uniqueTickers.size} tickers have price data (expected 500+ S&P 500)`);
    }

    if (summaryCount === 0 || summaryCount < 500) {
      issues.push(`⚠ MISSING SUMMARY DATA: Backtest summary cache is empty or incomplete (${summaryCount || 0} records)`);
    }

    if (signalsCount === 0) {
      issues.push(`⚠ MISSING SIGNALS DATA: Backtest signals table is empty`);
    }

    if (issues.length === 0) {
      console.log('✓ No critical issues detected\n');
    } else {
      issues.forEach(issue => console.log(`${issue}\n`));
    }

    // 7. Recommended Actions
    console.log('6. RECOMMENDED ACTIONS');
    console.log('═'.repeat(80) + '\n');

    const actions = [];

    if (uniqueTickers.size < 500) {
      actions.push('1. Run backfill to fetch missing price data for S&P 500 companies:');
      actions.push('   npm run backfill:missing');
      actions.push('');
    }

    if (summaryCount === 0 || summaryCount < 500) {
      actions.push('2. Compute backtest summary cache:');
      actions.push('   npm run compute:summary');
      actions.push('');
    }

    if (actions.length === 0) {
      actions.push('✓ Data appears to be current');
    }

    actions.forEach(action => console.log(action + '\n'));

    // 8. Data Flow Diagram
    console.log('7. DATA UPDATE FLOW');
    console.log('═'.repeat(80) + '\n');
    console.log('  assets (tickers list)');
    console.log('       ↓');
    console.log('  backfill:missing (fetch historical prices)');
    console.log('       ↓');
    console.log('  daily_prices (raw OHLCV data)');
    console.log('       ↓');
    console.log('  compute:summary (run DCA backtests)');
    console.log('       ↓');
    console.log('  backtest_summary (cached metrics)');
    console.log('       ↓');
    console.log('  Dashboard & API endpoints\n');

  } catch (error) {
    console.error('Error:', error);
  }

  console.log('═'.repeat(80) + '\n');
  process.exit(0);
}

generateReport();
