const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBacktestSummary() {
  try {
    console.log('Fetching backtest_summary data...\n');

    const { data, error } = await supabase
      .from('backtest_summary')
      .select('ticker, std_purchases_5y, std_invested_5y, enh_purchases_5y, enh_invested_5y, std_value_5y, std_return_5y, enh_value_5y, enh_return_5y')
      .limit(1000);

    if (error) {
      console.error('Error fetching data:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('No data found in backtest_summary');
      return;
    }

    console.log(`Found ${data.length} records. Checking for irregularities...\n`);

    let irregularities = 0;
    const issues = [];

    data.forEach(row => {
      const stdPurchases = row.std_purchases_5y || 0;
      const stdInvested = row.std_invested_5y || 0;
      const enhPurchases = row.enh_purchases_5y || 0;
      const enhInvested = row.enh_invested_5y || 0;
      const stdValue = row.std_value_5y || 0;
      const stdReturn = row.std_return_5y || 0;

      // Check 1: Math consistency for standard DCA (weekly $100)
      const expectedStdInvested = stdPurchases * 100;
      if (stdInvested > 0 && Math.abs(stdInvested - expectedStdInvested) > 50) {
        irregularities++;
        issues.push(
          `[${row.ticker}] Standard DCA: Invested ($${stdInvested.toFixed(0)}) doesn't match ` +
          `purchases × $100 ($${expectedStdInvested.toFixed(0)}). Diff: $${Math.abs(stdInvested - expectedStdInvested).toFixed(0)}`
        );
      }

      // Check 2: Return value relationship
      if (stdInvested > 0 && stdValue > 0) {
        const calculatedValue = stdInvested * (1 + stdReturn / 100);
        if (Math.abs(stdValue - calculatedValue) > stdInvested * 0.05) {
          irregularities++;
          issues.push(
            `[${row.ticker}] Standard: Value ($${stdValue.toFixed(0)}) inconsistent with invested ` +
            `($${stdInvested.toFixed(0)}) × (1 + ${stdReturn.toFixed(1)}%) = $${calculatedValue.toFixed(0)}`
          );
        }
      }

      // Check 3: Negative returns with value > invested
      if (stdReturn < 0 && stdValue > stdInvested) {
        irregularities++;
        issues.push(
          `[${row.ticker}] Negative return (${stdReturn.toFixed(1)}%) but value ($${stdValue.toFixed(0)}) > invested ($${stdInvested.toFixed(0)})`
        );
      }

      // Check 4: Enhanced should have fewer or equal purchases
      if (enhPurchases > stdPurchases && stdPurchases > 0) {
        irregularities++;
        issues.push(
          `[${row.ticker}] Enhanced (${enhPurchases}) > standard purchases (${stdPurchases})`
        );
      }

      // Check 5: Missing critical values
      if (!stdPurchases || !stdInvested || !stdValue) {
        irregularities++;
        issues.push(
          `[${row.ticker}] Missing data: purchases=${stdPurchases}, invested=${stdInvested}, value=${stdValue}`
        );
      }
    });

    if (issues.length > 0) {
      console.log(`Found ${irregularities} issue(s):\n`);
      issues.slice(0, 25).forEach(issue => console.log(`  ⚠️  ${issue}`));
      if (issues.length > 25) {
        console.log(`  ... and ${issues.length - 25} more`);
      }
    } else {
      console.log('✅ No obvious irregularities found!');
    }

    // Summary
    console.log(`\n--- Summary Stats ---`);
    const avgStdInvested = data.reduce((sum, r) => sum + (r.std_invested_5y || 0), 0) / data.length;
    const avgStdPurchases = data.reduce((sum, r) => sum + (r.std_purchases_5y || 0), 0) / data.length;
    console.log(`Average Standard Invested: $${avgStdInvested.toFixed(0)}`);
    console.log(`Average Standard Purchases: ${avgStdPurchases.toFixed(1)}`);
    console.log(`Average per purchase: $${(avgStdInvested / avgStdPurchases).toFixed(2)}`);

  } catch (err) {
    console.error('Error:', err);
  }
}

checkBacktestSummary();
