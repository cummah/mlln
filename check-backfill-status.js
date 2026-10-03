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

async function checkStatus() {
  console.log('\n' + '═'.repeat(80));
  console.log('BACKFILL STATUS CHECK');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get all tickers with data
    const { data: allPrices } = await supabase
      .from('daily_prices')
      .select('ticker')
      .limit(100000);

    const tickersWithData = new Set();
    if (allPrices) {
      allPrices.forEach(row => tickersWithData.add(row.ticker));
    }

    console.log(`✓ Total unique tickers with data: ${tickersWithData.size}\n`);

    // Get all active assets
    const { data: assets } = await supabase
      .from('assets')
      .select('ticker, name, is_active')
      .eq('is_active', true);

    if (!assets) {
      console.log('Could not fetch assets');
      process.exit(1);
    }

    const withData = assets.filter(a => tickersWithData.has(a.ticker));
    const withoutData = assets.filter(a => !tickersWithData.has(a.ticker));

    console.log(`Active assets with data: ${withData.length}`);
    console.log(`Active assets without data: ${withoutData.length}\n`);

    // Check the 6 problematic tickers
    console.log('Checking the 6 failed tickers:');
    console.log('─'.repeat(80));

    const problematicTickers = ['FAGIX', 'CCIH', 'CCXI', 'Q', 'CBOL', 'CEGX'];
    
    for (const ticker of problematicTickers) {
      const { count, error } = await supabase
        .from('daily_prices')
        .select('*', { count: 'exact' })
        .eq('ticker', ticker)
        .limit(0);

      const rowCount = error ? 0 : (count || 0);
      const status = rowCount >= 200 ? '✓' : '✗';
      const assetInfo = assets.find(a => a.ticker === ticker);
      
      console.log(`${status} ${ticker.padEnd(10)} ${rowCount} rows  ${assetInfo ? '- ' + assetInfo.name : '(not in assets)'}`);
    }

    console.log('\n' + '═'.repeat(80) + '\n');

    // Recommendations
    console.log('ANALYSIS & RECOMMENDATIONS:\n');
    
    if (withoutData.length > 10) {
      console.log(`⚠️  Still ${withoutData.length} active tickers without data`);
      console.log('   These may be:\n');
      
      const sample = withoutData.slice(0, 5);
      sample.forEach(a => {
        console.log(`   • ${a.ticker} (${a.name})`);
      });
      
      if (withoutData.length > 5) {
        console.log(`   ... and ${withoutData.length - 5} more\n`);
      }
      
      console.log('OPTIONS:\n');
      console.log('1. Check if tickers are valid on Yahoo Finance');
      console.log('2. Mark invalid/delisted tickers as inactive');
      console.log('3. Retry backfill for remaining tickers\n');
    } else {
      console.log(`✓ Only ${withoutData.length} active tickers still missing data`);
      console.log('  (These may be invalid/delisted symbols)\n');
    }

  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

checkStatus();
