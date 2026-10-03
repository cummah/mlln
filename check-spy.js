const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSPY() {
  const { data, error } = await supabase
    .from('backtest_summary')
    .select('ticker, std_invested_1y, enh_invested_1y, std_value_1y, enh_value_1y')
    .eq('ticker', 'SPY')
    .single();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
  process.exit(0);
}

checkSPY();
