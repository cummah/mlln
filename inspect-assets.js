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
  console.log('ASSET DATA INSPECTION');
  console.log('='.repeat(80));

  try {
    // 1. Check table structures
    console.log('\n1. Checking available tables and columns...\n');

    // Get assets with no filters - check if table exists
    const { data: assetsCount, error: assetsError } = await supabase
      .from('assets')
      .select('*', { count: 'exact', head: true });

    console.log(`✓ assets table: ${assetsCount} total records`);

    // Get a sample asset to see structure
    const { data: sampleAsset, error: sampleError } = await supabase
      .from('assets')
      .select('*')
      .limit(5);

    if (sampleAsset && sampleAsset.length > 0) {
      console.log(`  Sample asset:`, JSON.stringify(sampleAsset[0], null, 2));
    }

    // Get daily_prices sample
    const { data: samplePrice, error: priceError } = await supabase
      .from('daily_prices')
      .select('*')
      .limit(1);

    if (samplePrice && samplePrice.length > 0) {
      console.log(`\n✓ daily_prices table exists`);
      console.log(`  Sample record:`, JSON.stringify(samplePrice[0], null, 2));
    }

    // 2. Get all assets
    console.log('\n2. Fetching all assets...\n');

    let allAssets = [];
    let pageNum = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1);

      if (error) {
        console.log(`Error fetching page ${pageNum}:`, error);
        break;
      }

      if (!data || data.length === 0) break;
      allAssets = allAssets.concat(data);
      pageNum++;
    }

    console.log(`Retrieved ${allAssets.length} assets total\n`);

    // Organize by type
    const byType = {};
    allAssets.forEach(asset => {
      const type = asset.type || 'unknown';
      if (!byType[type]) byType[type] = [];
      byType[type].push(asset);
    });

    console.log('Assets by Type:');
    Object.entries(byType).forEach(([type, assets]) => {
      console.log(`  ${type}: ${assets.length}`);
    });

    // 3. Check data coverage
    console.log('\n3. Data Coverage Analysis\n');

    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const fiveYearsAgoStr = fiveYearsAgo.toISOString().split('T')[0];

    console.log(`Checking for data since: ${fiveYearsAgoStr}\n`);

    const assetsCoverage = [];

    for (const asset of allAssets) {
      // Get latest date and count for this ticker
      const { data: latestData, error: latestError } = await supabase
        .from('daily_prices')
        .select('date')
        .eq('ticker', asset.ticker)
        .order('date', { ascending: false })
        .limit(1);

      let latestDate = null;
      let dataCount = 0;

      if (!latestError && latestData && latestData.length > 0) {
        latestDate = latestData[0].date;

        // Count records in 5-year window
        const { count } = await supabase
          .from('daily_prices')
          .select('id', { count: 'exact' })
          .eq('ticker', asset.ticker)
          .gte('date', fiveYearsAgoStr);

        dataCount = count || 0;
      }

      assetsCoverage.push({
        ticker: asset.ticker,
        name: asset.name,
        type: asset.type,
        hasData: latestDate !== null,
        latestDate,
        dataCount,
        has5Years: latestDate && latestDate >= fiveYearsAgoStr,
      });
    }

    // Show results
    const withFiveYears = assetsCoverage.filter(a => a.has5Years);
    const incomplete = assetsCoverage.filter(a => a.hasData && !a.has5Years);
    const noData = assetsCoverage.filter(a => !a.hasData);

    console.log('SUMMARY:');
    console.log(`  Total Assets: ${assetsCoverage.length}`);
    console.log(`  With 5+ Years Data: ${withFiveYears.length}`);
    console.log(`  With Incomplete Data: ${incomplete.length}`);
    console.log(`  With No Data: ${noData.length}`);

    if (withFiveYears.length > 0 && withFiveYears.length <= 20) {
      console.log('\nAssets with 5+ years:');
      withFiveYears.forEach(a => {
        console.log(`  ✓ ${a.ticker.padEnd(10)} - ${a.dataCount} records, latest: ${a.latestDate}`);
      });
    } else if (withFiveYears.length > 20) {
      console.log(`\nShowing first 20 assets with 5+ years:`);
      withFiveYears.slice(0, 20).forEach(a => {
        console.log(`  ✓ ${a.ticker.padEnd(10)} - ${a.dataCount} records, latest: ${a.latestDate}`);
      });
    }

    if (incomplete.length > 0) {
      console.log('\nAssets with incomplete data:');
      incomplete.slice(0, 20).forEach(a => {
        console.log(`  ⚠ ${a.ticker.padEnd(10)} - ${a.dataCount} records, latest: ${a.latestDate}`);
      });
      if (incomplete.length > 20) {
        console.log(`  ... and ${incomplete.length - 20} more`);
      }
    }

    if (noData.length > 0) {
      console.log('\nAssets with no data:');
      noData.forEach(a => {
        console.log(`  ✗ ${a.ticker.padEnd(10)} (${a.type})`);
      });
    }

  } catch (error) {
    console.error('Error during inspection:', error);
  }

  console.log('\n' + '='.repeat(80));
  process.exit(0);
}

inspectAssets();
