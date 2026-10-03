const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSignals() {
  try {
    console.log('Checking signal coverage...\n');

    // Get all active assets
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('ticker')
      .eq('is_active', true);

    if (assetsError) {
      console.error('Error fetching assets:', assetsError);
      return;
    }

    const totalAssets = assets.length;
    console.log(`Total active assets: ${totalAssets}`);

    // Get backtest summary records
    const { data: summaries, error: summariesError } = await supabase
      .from('backtest_summary')
      .select('ticker');

    if (summariesError) {
      console.error('Error fetching summaries:', summariesError);
      return;
    }

    const totalSummaries = summaries.length;
    const summaryTickers = new Set(summaries.map(s => s.ticker));

    console.log(`Backtest summary records: ${totalSummaries}`);
    console.log(`Coverage: ${((totalSummaries / totalAssets) * 100).toFixed(1)}%\n`);

    // Find missing summaries
    const missingSignals = assets.filter(a => !summaryTickers.has(a.ticker));
    
    if (missingSignals.length > 0) {
      console.log(`⚠️  Missing backtest summary for ${missingSignals.length} assets:`);
      missingSignals.slice(0, 20).forEach(a => console.log(`   - ${a.ticker}`));
      if (missingSignals.length > 20) {
        console.log(`   ... and ${missingSignals.length - 20} more`);
      }
    } else {
      console.log('✅ All active assets have backtest summaries!');
    }

    // Check for signals with data
    const { data: signalsWithData } = await supabase
      .from('backtest_summary')
      .select('ticker')
      .gt('std_purchases_5y', 0);

    const withData = new Set(signalsWithData.map(s => s.ticker));
    const emptySignals = summaries.filter(s => !withData.has(s.ticker));

    if (emptySignals.length > 0) {
      console.log(`\n⚠️  Backtest records with NO signal data: ${emptySignals.length}`);
      emptySignals.forEach(s => console.log(`   - ${s.ticker}`));
    } else {
      console.log('\n✅ All backtest records have signal data!');
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

checkSignals();
