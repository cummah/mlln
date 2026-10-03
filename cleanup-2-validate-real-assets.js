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

async function validateAssets() {
  console.log('\n' + '═'.repeat(80));
  console.log('STEP 2: VALIDATE ASSETS - KEEP REAL ONES, REMOVE INVALID & DUPLICATES');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get all assets
    const { data: allAssets } = await supabase
      .from('assets')
      .select('id, ticker, name, is_active');

    console.log(`Total assets in database: ${allAssets?.length || 0}\n`);

    // Step 2a: Find and delete duplicates
    console.log('Step 2a: Finding duplicates...\n');

    const seenTickers = new Set();
    const duplicates = [];

    allAssets?.forEach(asset => {
      if (seenTickers.has(asset.ticker)) {
        duplicates.push(asset);
      } else {
        seenTickers.add(asset.ticker);
      }
    });

    console.log(`Found ${duplicates.length} duplicate entries`);

    if (duplicates.length > 0) {
      console.log('Deleting duplicates...\n');
      let deletedCount = 0;

      for (const asset of duplicates) {
        const { error } = await supabase
          .from('assets')
          .delete()
          .eq('id', asset.id);

        if (!error) deletedCount++;
      }

      console.log(`Deleted: ${deletedCount} duplicates\n`);
    }

    // Get unique assets only
    const uniqueAssets = Array.from(seenTickers).map(ticker =>
      allAssets.find(a => a.ticker === ticker)
    ).filter(Boolean);

    console.log(`Unique assets to validate: ${uniqueAssets.length}\n`);

    // Step 2b: Validate which assets exist on Yahoo Finance
    console.log('Step 2b: Validating assets on Yahoo Finance...\n');
    console.log('(This checks if each ticker has real data)\n');

    const validAssets = [];
    const invalidAssets = [];
    let checkedCount = 0;

    for (const asset of uniqueAssets) {
      const ticker = asset.ticker;

      // Skip index tickers (start with ^) - assume valid
      if (ticker.startsWith('^')) {
        validAssets.push(asset);
        checkedCount++;
        if (checkedCount % 50 === 0) {
          console.log(`  Checked ${checkedCount}/${uniqueAssets.length} - ${ticker} (index, skipped validation)`);
        }
        await delay(100);
        continue;
      }

      try {
        // Try to fetch one day of data
        const result = await yf.quote(ticker);

        if (result && result.symbol) {
          validAssets.push(asset);
          if (checkedCount % 50 === 0) {
            console.log(`  Checked ${checkedCount}/${uniqueAssets.length} - ${ticker} ✓ VALID`);
          }
        } else {
          invalidAssets.push(asset);
          if (checkedCount % 50 === 0) {
            console.log(`  Checked ${checkedCount}/${uniqueAssets.length} - ${ticker} ✗ NOT FOUND`);
          }
        }
      } catch (err) {
        // If Yahoo Finance can't find it, mark as invalid
        invalidAssets.push(asset);
        if (checkedCount % 50 === 0) {
          console.log(`  Checked ${checkedCount}/${uniqueAssets.length} - ${ticker} ✗ ERROR (${err.message})`);
        }
      }

      checkedCount++;
      await delay(500); // Conservative rate limiting
    }

    console.log(`\n✓ Validation complete\n`);

    // Step 2c: Mark invalid assets as inactive
    console.log('Step 2c: Marking invalid assets as inactive...\n');

    let markedInactive = 0;

    for (const asset of invalidAssets) {
      const { error } = await supabase
        .from('assets')
        .update({ is_active: false })
        .eq('ticker', asset.ticker);

      if (!error) markedInactive++;
    }

    console.log(`Marked inactive: ${markedInactive} invalid tickers\n`);

    // Step 2d: Verify results
    console.log('Step 2d: Verification\n');

    const { data: finalActive } = await supabase
      .from('assets')
      .select('ticker', { count: 'exact' })
      .eq('is_active', true);

    const { data: finalInactive } = await supabase
      .from('assets')
      .select('ticker', { count: 'exact' })
      .eq('is_active', false);

    console.log(`Active assets (real, validated): ${finalActive?.length || 0}`);
    console.log(`Inactive assets (invalid/not found): ${finalInactive?.length || 0}`);
    console.log(`Total: ${(finalActive?.length || 0) + (finalInactive?.length || 0)}\n`);

    if (finalActive && finalActive.length > 0) {
      console.log('Sample of valid assets:');
      const sample = finalActive.slice(0, 30);
      sample.forEach(a => console.log(`  • ${a.ticker}`));
      if (finalActive.length > 30) {
        console.log(`  ... and ${finalActive.length - 30} more`);
      }
    }

    console.log('\n✓ ASSETS VALIDATION COMPLETE\n');
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('Fatal error:', error);
  }

  process.exit(0);
}

validateAssets();
