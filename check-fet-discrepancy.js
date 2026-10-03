const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY env vars');
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseKey);

async function checkFET() {
  try {
    // Check enhanced table
    const { data: enhanced, error: enhError } = await client
      .from('backtest_summary')
      .select('ticker, enh_return_1y, enh_return_3y, enh_return_5y, monthly_enh_return_1y, alpha_1y')
      .eq('ticker', 'FET')
      .single();

    if (enhError) {
      console.error('Error fetching from backtest_summary:', enhError);
    } else {
      console.log('Enhanced Model (backtest_summary):', enhanced);
    }

    // Check macro table
    const { data: macro, error: macroError } = await client
      .from('backtest_summary_macro')
      .select('ticker, enh_return_1y, enh_return_3y, enh_return_5y, monthly_enh_return_1y, alpha_1y')
      .eq('ticker', 'FET')
      .single();

    if (macroError) {
      console.error('Error fetching from backtest_summary_macro:', macroError);
    } else {
      console.log('Macro Model (backtest_summary_macro):', macro);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

checkFET();
