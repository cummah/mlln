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

async function checkSNDK() {
  console.log('\n' + '═'.repeat(80));
  console.log('SNDK (SanDisk) DATA CHECK');
  console.log('═'.repeat(80) + '\n');

  try {
    // 1. Check if SNDK exists in assets table
    console.log('1. ASSETS TABLE CHECK');
    console.log('─'.repeat(80));
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('*')
      .eq('ticker', 'SNDK')
      .single();

    if (assetError || !asset) {
      console.log('❌ SNDK not found in assets table');
    } else {
      console.log('✓ SNDK found in assets table:');
      console.log(`  - Name: ${asset.name}`);
      console.log(`  - Sector: ${asset.sector}`);
      console.log(`  - is_active: ${asset.is_active}`);
      console.log(`  - asset_type: ${asset.asset_type}`);
    }

    // 2. Check daily_prices table
    console.log('\n2. DAILY_PRICES TABLE CHECK');
    console.log('─'.repeat(80));
    const { count: priceCount } = await supabase
      .from('daily_prices')
      .select('*', { count: 'exact' })
      .eq('ticker', 'SNDK');

    if (!priceCount || priceCount === 0) {
      console.log('❌ No price data found for SNDK');
    } else {
      console.log(`✓ Found ${priceCount?.toLocaleString()} price records for SNDK`);

      // Get date range
      const { data: priceData } = await supabase
        .from('daily_prices')
        .select('date')
        .eq('ticker', 'SNDK')
        .order('date', { ascending: true })
        .limit(1);

      const { data: latestPrice } = await supabase
        .from('daily_prices')
        .select('date')
        .eq('ticker', 'SNDK')
        .order('date', { ascending: false })
        .limit(1);

      if (priceData && priceData.length > 0) {
        console.log(`  - Earliest date: ${priceData[0].date}`);
      }
      if (latestPrice && latestPrice.length > 0) {
        console.log(`  - Latest date: ${latestPrice[0].date}`);
      }
    }

    // 3. Check daily_signals table
    console.log('\n3. DAILY_SIGNALS TABLE CHECK');
    console.log('─'.repeat(80));
    const { count: dailySignalCount } = await supabase
      .from('daily_signals')
      .select('*', { count: 'exact' })
      .eq('ticker', 'SNDK');

    if (!dailySignalCount || dailySignalCount === 0) {
      console.log('❌ No daily signals found for SNDK');
    } else {
      console.log(`✓ Found ${dailySignalCount?.toLocaleString()} daily signal records for SNDK`);
    }

    // 4. Check weekly_signals table
    console.log('\n4. WEEKLY_SIGNALS TABLE CHECK');
    console.log('─'.repeat(80));
    const { count: weeklySignalCount } = await supabase
      .from('weekly_signals')
      .select('*', { count: 'exact' })
      .eq('ticker', 'SNDK');

    if (!weeklySignalCount || weeklySignalCount === 0) {
      console.log('❌ No weekly signals found for SNDK');
    } else {
      console.log(`✓ Found ${weeklySignalCount?.toLocaleString()} weekly signal records for SNDK`);
    }

    // 5. Check monthly_signals table
    console.log('\n5. MONTHLY_SIGNALS TABLE CHECK');
    console.log('─'.repeat(80));
    const { count: monthlySignalCount } = await supabase
      .from('monthly_signals')
      .select('*', { count: 'exact' })
      .eq('ticker', 'SNDK');

    if (!monthlySignalCount || monthlySignalCount === 0) {
      console.log('❌ No monthly signals found for SNDK');
    } else {
      console.log(`✓ Found ${monthlySignalCount?.toLocaleString()} monthly signal records for SNDK`);
    }

    // 6. Check asset_macro_metrics table
    console.log('\n6. ASSET_MACRO_METRICS TABLE CHECK');
    console.log('─'.repeat(80));
    const { data: macroMetrics } = await supabase
      .from('asset_macro_metrics')
      .select('*')
      .eq('ticker', 'SNDK')
      .single();

    if (!macroMetrics) {
      console.log('❌ No macro metrics found for SNDK');
    } else {
      console.log('✓ Macro metrics found for SNDK:');
      console.log(`  - daily_signal_strength: ${macroMetrics.daily_signal_strength}`);
      console.log(`  - weekly_signal_strength: ${macroMetrics.weekly_signal_strength}`);
      console.log(`  - monthly_signal_strength: ${macroMetrics.monthly_signal_strength}`);
      console.log(`  - metrics_updated_at: ${macroMetrics.metrics_updated_at}`);
    }

    // Summary
    console.log('\n' + '═'.repeat(80));
    console.log('SUMMARY');
    console.log('═'.repeat(80));
    const hasData = priceCount && priceCount > 0;
    const hasSignals = (dailySignalCount && dailySignalCount > 0) ||
                       (weeklySignalCount && weeklySignalCount > 0) ||
                       (monthlySignalCount && monthlySignalCount > 0);

    console.log(`Historic price data:    ${hasData ? '✓' : '❌'}`);
    console.log(`Signals data:           ${hasSignals ? '✓' : '❌'}`);
    console.log(`Macro metrics:          ${macroMetrics ? '✓' : '❌'}`);

  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

checkSNDK();
