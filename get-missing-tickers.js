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

async function getMissingTickers() {
  console.log('Fetching all assets and checking which have price data...\n');

  try {
    // Get all assets
    let allAssets = [];
    let pageNum = 0;
    const pageSize = 1000;

    console.log('Loading assets...');
    while (true) {
      const { data, error } = await supabase
        .from('assets')
        .select('ticker, name, sector, is_active')
        .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1);

      if (error) {
        console.error('Error:', error);
        break;
      }

      if (!data || data.length === 0) break;
      allAssets = allAssets.concat(data);
      console.log(`  Loaded ${allAssets.length} assets...`);
      pageNum++;
    }

    console.log(`Total: ${allAssets.length} assets\n`);

    // Get all tickers with price data
    console.log('Fetching tickers with price data...');
    let allPrices = [];
    pageNum = 0;

    while (true) {
      const { data, error } = await supabase
        .from('daily_prices')
        .select('ticker')
        .limit(10000)
        .range(pageNum * 10000, (pageNum + 1) * 10000 - 1);

      if (error) break;
      if (!data || data.length === 0) break;

      allPrices = allPrices.concat(data);
      pageNum++;
    }

    const tickersWithData = new Set(allPrices.map(p => p.ticker));
    console.log(`Found ${tickersWithData.size} unique tickers with data\n`);

    // Categorize assets
    const categorized = {
      hasData: [],
      noData: [],
      active: { hasData: 0, noData: 0 },
      inactive: { hasData: 0, noData: 0 }
    };

    for (const asset of allAssets) {
      if (tickersWithData.has(asset.ticker)) {
        categorized.hasData.push(asset);
        if (asset.is_active) {
          categorized.active.hasData++;
        } else {
          categorized.inactive.hasData++;
        }
      } else {
        categorized.noData.push(asset);
        if (asset.is_active) {
          categorized.active.noData++;
        } else {
          categorized.inactive.noData++;
        }
      }
    }

    // Summary
    console.log('═'.repeat(80));
    console.log('SUMMARY');
    console.log('═'.repeat(80));
    console.log(`\nAssets WITH data: ${categorized.hasData.length}`);
    console.log(`  Active: ${categorized.active.hasData}`);
    console.log(`  Inactive: ${categorized.inactive.hasData}`);

    console.log(`\nAssets WITHOUT data: ${categorized.noData.length}`);
    console.log(`  Active: ${categorized.active.noData} ⚠️ NEED TO BACKFILL`);
    console.log(`  Inactive: ${categorized.inactive.noData} (expected - not updated)`);

    // Save to files
    console.log('\n═'.repeat(80));
    console.log('SAVING RESULTS');
    console.log('═'.repeat(80) + '\n');

    // Active with data
    const activeWithData = categorized.hasData.filter(a => a.is_active);
    fs.writeFileSync(
      'TICKERS_WITH_DATA.txt',
      activeWithData.map(a => `${a.ticker.padEnd(10)} - ${a.name}`).join('\n')
    );
    console.log(`✓ Saved ${activeWithData.length} active tickers with data to TICKERS_WITH_DATA.txt`);

    // Active without data (CRITICAL)
    const activeNoData = categorized.noData.filter(a => a.is_active);
    fs.writeFileSync(
      'TICKERS_MISSING_DATA.txt',
      activeNoData.map(a => `${a.ticker.padEnd(10)} - ${a.name} (${a.sector || 'Unknown'})`).join('\n')
    );
    console.log(`✗ Saved ${activeNoData.length} active tickers WITHOUT data to TICKERS_MISSING_DATA.txt`);

    // Just ticker symbols for backfill script
    fs.writeFileSync(
      'MISSING_TICKERS_LIST.txt',
      activeNoData.map(a => a.ticker).join(',')
    );
    console.log(`✓ Saved comma-separated ticker list to MISSING_TICKERS_LIST.txt`);

    // Inactive without data (expected)
    const inactiveNoData = categorized.noData.filter(a => !a.is_active);
    fs.writeFileSync(
      'TICKERS_INACTIVE_NO_DATA.txt',
      inactiveNoData.map(a => `${a.ticker.padEnd(10)} - ${a.name} (${a.sector || 'Unknown'})`).join('\n')
    );
    console.log(`✓ Saved ${inactiveNoData.length} inactive tickers to TICKERS_INACTIVE_NO_DATA.txt`);

    // By sector
    const bySector = {};
    activeNoData.forEach(asset => {
      const sector = asset.sector || 'Unknown';
      if (!bySector[sector]) bySector[sector] = [];
      bySector[sector].push(asset);
    });

    const sectorReport = Object.entries(bySector)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([sector, stocks]) =>
        `${sector} (${stocks.length}):\n  ${stocks.map(s => s.ticker).join(', ')}`
      )
      .join('\n\n');

    fs.writeFileSync('MISSING_TICKERS_BY_SECTOR.txt', sectorReport);
    console.log(`✓ Saved sector breakdown to MISSING_TICKERS_BY_SECTOR.txt`);

    // Display sample
    console.log('\n═'.repeat(80));
    console.log('SAMPLE - MISSING TICKERS BY SECTOR');
    console.log('═'.repeat(80) + '\n');

    Object.entries(bySector)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5)
      .forEach(([sector, stocks]) => {
        console.log(`${sector} (${stocks.length} stocks):`);
        stocks.slice(0, 10).forEach(stock => {
          console.log(`  ${stock.ticker.padEnd(10)} - ${stock.name}`);
        });
        if (stocks.length > 10) {
          console.log(`  ... and ${stocks.length - 10} more`);
        }
        console.log('');
      });

    console.log('═'.repeat(80) + '\n');

    // Quick manual backfill command
    console.log('TO BACKFILL MISSING DATA:');
    console.log('═'.repeat(80));
    console.log('\nOption 1 (Recommended - runs full backfill):\n');
    console.log('  npm run backfill:missing\n');
    console.log('Option 2 (Specific tickers):\n');
    console.log('  npm run backfill:prices -- --tickers=' + activeNoData.slice(0, 10).map(a => a.ticker).join(',') + '\n');
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('Fatal error:', error);
  }

  process.exit(0);
}

getMissingTickers();
