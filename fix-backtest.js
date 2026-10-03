const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixBacktestSummary() {
  try {
    console.log('Fetching backtest_summary data...\n');

    const { data, error } = await supabase
      .from('backtest_summary')
      .select('ticker, std_purchases_5y, std_invested_5y, std_value_5y, std_return_5y, enh_purchases_5y, enh_invested_5y, enh_value_5y, enh_return_5y, monthly_std_invested_5y, monthly_std_value_5y, monthly_std_return_5y, monthly_enh_invested_5y, monthly_enh_value_5y, monthly_enh_return_5y');

    if (error) {
      console.error('Error fetching data:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('No data found');
      return;
    }

    console.log(`Found ${data.length} records. Fixing invested amounts...\n`);

    const updates = [];

    data.forEach(row => {
      // Weekly calculations
      const stdPurchases = row.std_purchases_5y || 0;
      const enhPurchases = row.enh_purchases_5y || 0;
      const stdReturn = row.std_return_5y || 0;
      const enhReturn = row.enh_return_5y || 0;

      // Fix standard weekly
      const newStdInvested = stdPurchases * 100;
      const newStdValue = newStdInvested * (1 + stdReturn / 100);

      // Fix enhanced weekly (assume average multiplier from current ratio)
      let newEnhInvested = row.enh_invested_5y || 0;
      let newEnhValue = row.enh_value_5y || 0;
      
      if (row.enh_invested_5y && row.std_invested_5y) {
        const ratio = row.enh_invested_5y / row.std_invested_5y;
        newEnhInvested = newStdInvested * ratio;
        newEnhValue = newEnhInvested * (1 + enhReturn / 100);
      }

      // Fix monthly values
      const monthlyStdReturn = row.monthly_std_return_5y || 0;
      const monthlyEnhReturn = row.monthly_enh_return_5y || 0;
      
      // Monthly: 60 months × $433 = $25,980
      const newMonthlyStdInvested = 60 * 433;
      const newMonthlyStdValue = newMonthlyStdInvested * (1 + monthlyStdReturn / 100);

      let newMonthlyEnhInvested = row.monthly_enh_invested_5y || 0;
      let newMonthlyEnhValue = row.monthly_enh_value_5y || 0;
      
      if (row.monthly_enh_invested_5y && row.monthly_std_invested_5y) {
        const monthlyRatio = row.monthly_enh_invested_5y / row.monthly_std_invested_5y;
        newMonthlyEnhInvested = newMonthlyStdInvested * monthlyRatio;
        newMonthlyEnhValue = newMonthlyEnhInvested * (1 + monthlyEnhReturn / 100);
      }

      updates.push({
        ticker: row.ticker,
        std_invested_5y: newStdInvested,
        std_value_5y: newStdValue,
        enh_invested_5y: newEnhInvested,
        enh_value_5y: newEnhValue,
        monthly_std_invested_5y: newMonthlyStdInvested,
        monthly_std_value_5y: newMonthlyStdValue,
        monthly_enh_invested_5y: newMonthlyEnhInvested,
        monthly_enh_value_5y: newMonthlyEnhValue,
      });
    });

    console.log(`Updating ${updates.length} records...\n`);

    // Update in batches
    const batchSize = 50;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      for (const update of batch) {
        const { error: updateError } = await supabase
          .from('backtest_summary')
          .update({
            std_invested_5y: update.std_invested_5y,
            std_value_5y: update.std_value_5y,
            enh_invested_5y: update.enh_invested_5y,
            enh_value_5y: update.enh_value_5y,
            monthly_std_invested_5y: update.monthly_std_invested_5y,
            monthly_std_value_5y: update.monthly_std_value_5y,
            monthly_enh_invested_5y: update.monthly_enh_invested_5y,
            monthly_enh_value_5y: update.monthly_enh_value_5y,
          })
          .eq('ticker', update.ticker);

        if (updateError) {
          console.error(`Error updating ${update.ticker}:`, updateError);
        }
      }
      
      console.log(`Updated ${Math.min(i + batchSize, updates.length)}/${updates.length} records...`);
    }

    console.log('\n✅ Fix complete!');
    console.log('\nExample changes:');
    const exampleUpdates = updates.slice(0, 3);
    exampleUpdates.forEach(u => {
      console.log(`  ${u.ticker}: std_invested $24,100 → $${u.std_invested_5y.toFixed(0)}`);
    });

  } catch (err) {
    console.error('Error:', err);
  }
}

fixBacktestSummary();
