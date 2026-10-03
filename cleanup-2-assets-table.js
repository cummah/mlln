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

// Verified S&P 500 companies with real, freely available Yahoo Finance data
const REAL_ASSETS = [
  // Top 50 by market cap (most stable)
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'JNJ',
  'V', 'WMT', 'JPM', 'PG', 'MA', 'HD', 'DIS', 'ADBE', 'CMCSA', 'COST',
  'KO', 'LLY', 'INTC', 'CRM', 'NFLX', 'BA', 'MMM', 'NKE', 'IBM', 'CSCO',

  // More S&P 500 (add more verified tickers here)
  'MCD', 'ABBV', 'ORCL', 'HON', 'BMY', 'ACN', 'PYPL', 'AMGX', 'ISRG', 'VRTX',
  'INTU', 'PEP', 'QCOM', 'AVGO', 'TXN', 'GILD', 'CVX', 'XOM', 'COP', 'MPC',

  // Major indexes
  '^VIX', 'SPY', '^GSPC', '^IXIC', '^DJI', 'QQQ', 'DIA', 'IWM', 'EEM',

  // ETFs with daily data
  'VTI', 'VOO', 'VTV', 'VUG', 'VB', 'VIOO', 'VGT', 'VHV', 'VDC', 'VPU',
  'VYM', 'DGRO', 'SCHB', 'SCHD', 'SCHA', 'SCHF', 'SCHG', 'SPHD', 'SPLG', 'VYMI',

  // Bond/Income ETFs
  'BND', 'BNDX', 'VGIT', 'VCIT', 'VCSH', 'VGSH', 'VCEB', 'VWOB', 'SHY', 'IEF',
  'TLH', 'BIL', 'VGSH', 'VSMAX',

  // More stocks with good data
  'AON', 'APD', 'CCOI', 'CHTR', 'ATOS', 'ATR', 'BY', 'BYND', 'CNP', 'COF',
  'ERIE', 'ES', 'HPQ', 'MAS', 'PNC', 'PNR', 'SYY', 'VXUS', 'VYMI', 'XMPT',
  'VIG', 'NOBL', 'FAST', 'FICO', 'SCHD', 'CVMX',

  // Add more S&P 500 stocks
  'ABT', 'ASPN', 'AXP', 'BDX', 'BK', 'BSX', 'CAT', 'CI', 'CMDS', 'CNC',
  'CTXS', 'DD', 'DG', 'DOV', 'DFS', 'ETN', 'EW', 'FDX', 'GE', 'GRMN',
  'GPN', 'GS', 'HAL', 'HCA', 'HES', 'HIG', 'HRL', 'HUN', 'IP', 'IPG',
  'IQV', 'JBHT', 'JCI', 'JKHY', 'KLAC', 'KKR', 'KMB', 'KMI', 'KMX', 'KSU'
];

async function cleanAssets() {
  console.log('\n' + '═'.repeat(80));
  console.log('STEP 2: CLEAN ASSETS TABLE');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get all current assets
    const { data: allAssets } = await supabase
      .from('assets')
      .select('id, ticker, name, is_active');

    console.log(`Total assets before cleanup: ${allAssets?.length || 0}\n`);

    const validAssets = [];
    const invalidAssets = [];
    const duplicates = [];

    // Track seen tickers
    const seenTickers = new Set();

    allAssets?.forEach(asset => {
      // Check for duplicates
      if (seenTickers.has(asset.ticker)) {
        duplicates.push(asset);
        return;
      }

      // Check if valid
      if (REAL_ASSETS.includes(asset.ticker)) {
        validAssets.push(asset);
        seenTickers.add(asset.ticker);
      } else {
        invalidAssets.push(asset);
      }
    });

    console.log(`Valid assets to KEEP: ${validAssets.length}`);
    console.log(`Invalid assets to mark inactive: ${invalidAssets.length}`);
    console.log(`Duplicate entries to delete: ${duplicates.length}\n`);

    // Step 2a: Delete duplicates
    console.log('Step 2a: Deleting duplicate entries...\n');
    let deletedDuplicates = 0;

    for (const asset of duplicates) {
      const { error } = await supabase
        .from('assets')
        .delete()
        .eq('id', asset.id);

      if (!error) deletedDuplicates++;
    }

    console.log(`Deleted: ${deletedDuplicates} duplicate entries\n`);

    // Step 2b: Mark invalid as inactive
    console.log('Step 2b: Marking invalid tickers as inactive...\n');

    const invalidTickers = invalidAssets.map(a => a.ticker);
    let updatedInactive = 0;

    for (const ticker of invalidTickers) {
      const { error } = await supabase
        .from('assets')
        .update({ is_active: false })
        .eq('ticker', ticker);

      if (!error) updatedInactive++;
    }

    console.log(`Marked inactive: ${updatedInactive} tickers\n`);

    // Step 2c: Verify
    const { data: remaining } = await supabase
      .from('assets')
      .select('id', { count: 'exact' })
      .eq('is_active', true);

    const { data: active } = await supabase
      .from('assets')
      .select('ticker')
      .eq('is_active', true);

    console.log('Step 2c: Verification\n');
    console.log(`Active assets after cleanup: ${active?.length || 0}`);
    console.log(`Expected: ~${validAssets.length}`);

    if (active && active.length > 0) {
      console.log('\nActive tickers (sample):');
      active.slice(0, 20).forEach(a => console.log(`  • ${a.ticker}`));
      if (active.length > 20) {
        console.log(`  ... and ${active.length - 20} more`);
      }
    }

    console.log('\n✓ ASSETS CLEANUP COMPLETE\n');
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

cleanAssets();
