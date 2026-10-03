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

async function validateAssets() {
  console.log('\n' + '═'.repeat(80));
  console.log('ASSET TABLE ANALYSIS');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get all assets
    const { data: allAssets } = await supabase
      .from('assets')
      .select('ticker, name, is_active, sector');

    if (!allAssets) {
      console.log('Could not fetch assets');
      process.exit(1);
    }

    console.log(`Total assets: ${allAssets.length}\n`);

    // Categorize assets
    const categories = {
      indexTickers: [], // Start with ^
      suspiciousTickers: [], // Short unusual symbols
      normalTickers: [],
      inactive: [],
    };

    const indexPatterns = ['^', 'VIX', 'SPY', 'QQQ', 'DIA', 'IWM'];
    const suspiciousPatterns = [
      /^[A-Z]$/, // Single letter
      /^[A-Z]{2}$/, // Two letters
      /XYZ/, /ASIA/, /TEST/, /DEMO/, /XY/, /AB/, /ZZ/, /AA/
    ];

    allAssets.forEach(asset => {
      if (!asset.is_active) {
        categories.inactive.push(asset);
      } else if (asset.ticker.startsWith('^')) {
        categories.indexTickers.push(asset);
      } else if (suspiciousPatterns.some(pattern =>
        typeof pattern === 'string'
          ? asset.ticker.includes(pattern)
          : pattern.test(asset.ticker)
      )) {
        categories.suspiciousTickers.push(asset);
      } else {
        categories.normalTickers.push(asset);
      }
    });

    console.log('BREAKDOWN:\n');
    console.log(`  Index Tickers (^VIX, SPY, etc):    ${categories.indexTickers.length}`);
    if (categories.indexTickers.length > 0) {
      categories.indexTickers.slice(0, 10).forEach(a => {
        console.log(`    • ${a.ticker.padEnd(10)} - ${a.name}`);
      });
    }

    console.log(`\n  Suspicious/Invalid Tickers:        ${categories.suspiciousTickers.length}`);
    if (categories.suspiciousTickers.length > 0) {
      console.log(`    (Single/double letter, test symbols, etc)`);
      categories.suspiciousTickers.slice(0, 10).forEach(a => {
        console.log(`    • ${a.ticker.padEnd(10)} - ${a.name}`);
      });
      if (categories.suspiciousTickers.length > 10) {
        console.log(`    ... and ${categories.suspiciousTickers.length - 10} more\n`);
      }
    }

    console.log(`\n  Valid S&P 500 Candidates:          ${categories.normalTickers.length}`);
    console.log(`  Inactive (Delisted):               ${categories.inactive.length}\n`);

    // Show sample valid tickers
    console.log('Sample valid tickers:');
    categories.normalTickers.slice(0, 20).forEach(a => {
      console.log(`  • ${a.ticker.padEnd(10)} - ${a.name}`);
    });

    // Stats
    console.log('\n' + '─'.repeat(80));
    console.log('RECOMMENDATIONS:\n');

    if (categories.suspiciousTickers.length > 20) {
      console.log(`⚠️  Found ${categories.suspiciousTickers.length} suspicious tickers`);
      console.log('   These may be causing backfill failures\n');
      console.log('   Options:');
      console.log('   1. Mark as inactive: UPDATE assets SET is_active = false WHERE ticker IN (...)');
      console.log('   2. Delete them: DELETE FROM assets WHERE ticker IN (...)');
      console.log('   3. Just ignore: Skip them in backfill\n');
    }

    if (categories.normalTickers.length < 500) {
      console.log(`⚠️  Only ${categories.normalTickers.length} potentially valid tickers`);
      console.log('   S&P 500 has 500+ companies - missing some?\n');
    }

    console.log('Next steps:');
    console.log('1. Clean up invalid tickers');
    console.log('2. Run backfill again with error handling');
    console.log('3. Check which ones actually have Yahoo Finance data\n');

  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

validateAssets();
