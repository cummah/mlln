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

async function deleteIncomplete() {
  console.log('\n' + '═'.repeat(80));
  console.log('STEP 1: DELETE INCOMPLETE DATA FROM DAILY_PRICES');
  console.log('═'.repeat(80) + '\n');

  try {
    // Tickers with complete data (1333+ rows = 5+ years)
    const completeTickers = [
      '^VIX', 'SPY', 'ATOS', 'ATR', 'BY', 'BYND', 'CNP', 'COF', 'ERIE', 'ES',
      'HPQ', 'MAS', 'MCD', 'PNC', 'PNR', 'SYY', 'VXUS', 'VYMI', 'AMGN', 'AON',
      'APD', 'CCOI', 'CHTR', 'CVX', 'DGRO', 'FAST', 'FICO', 'SCHD', 'XMPT', 'VIZ',
      'NOBL', 'SPHD', 'SCHB', 'BNDX', 'VWOB', 'VCEB', 'VGIT', 'TLH', 'IEF', 'SHY',
      'BIL', 'VGSH', 'VCSH', 'VCIT', 'VSMAX'
    ];

    console.log(`Complete tickers to KEEP: ${completeTickers.length}`);
    completeTickers.forEach(t => console.log(`  • ${t}`));

    console.log('\nStep 1a: Get current row counts...\n');

    const { count: totalBefore } = await supabase
      .from('daily_prices')
      .select('*', { count: 'exact' })
      .limit(0);

    console.log(`Total rows before: ${totalBefore?.toLocaleString()}`);

    // Count rows we're keeping
    let rowsToKeep = 0;
    for (const ticker of completeTickers) {
      const { count } = await supabase
        .from('daily_prices')
        .select('*', { count: 'exact' })
        .eq('ticker', ticker)
        .limit(0);

      rowsToKeep += count || 0;
    }

    console.log(`Rows to KEEP (complete data): ${rowsToKeep.toLocaleString()}`);
    console.log(`Rows to DELETE (incomplete): ${(totalBefore - rowsToKeep).toLocaleString()}\n`);

    // Delete incomplete data
    console.log('Step 1b: Deleting incomplete data...\n');

    // Delete in batches by ticker
    const { data: allTickers } = await supabase
      .from('daily_prices')
      .select('ticker')
      .limit(100000);

    const uniqueTickers = [...new Set(allTickers?.map(t => t.ticker) || [])];
    const tickersToDelete = uniqueTickers.filter(t => !completeTickers.includes(t));

    console.log(`Found ${tickersToDelete.length} tickers with incomplete data\n`);

    let deletedCount = 0;
    for (const ticker of tickersToDelete) {
      const { count, error } = await supabase
        .from('daily_prices')
        .delete()
        .eq('ticker', ticker);

      if (!error) {
        deletedCount += count || 0;
        if (tickersToDelete.indexOf(ticker) % 10 === 0) {
          console.log(`  Deleted rows for ticker ${tickersToDelete.indexOf(ticker) + 1}/${tickersToDelete.length}`);
        }
      }
    }

    console.log(`\nTotal deleted: ${deletedCount.toLocaleString()} rows\n`);

    // Verify
    const { count: totalAfter } = await supabase
      .from('daily_prices')
      .select('*', { count: 'exact' })
      .limit(0);

    console.log('Step 1c: Verification\n');
    console.log(`Total rows after: ${totalAfter?.toLocaleString()}`);
    console.log(`Expected: ~${rowsToKeep.toLocaleString()}`);

    if (Math.abs((totalAfter || 0) - rowsToKeep) < 100) {
      console.log('✓ CLEANUP SUCCESSFUL\n');
    } else {
      console.log('⚠ Mismatch - may need manual verification\n');
    }

    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

deleteIncomplete();
