const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf-8');
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  const { data: row, error } = await supabase
    .from('backtest_summary')
    .select('ticker, std_invested_1y, enh_invested_1y, monthly_std_invested_1y, monthly_enh_invested_1y')
    .eq('ticker', 'SPY')
    .single();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('SPY 1Y Data:');
    console.log(`  std_invested_1y: ${row.std_invested_1y}`);
    console.log(`  enh_invested_1y: ${row.enh_invested_1y}`);
    console.log(`  monthly_std_invested_1y: ${row.monthly_std_invested_1y}`);
    console.log(`  monthly_enh_invested_1y: ${row.monthly_enh_invested_1y}`);
  }

  process.exit(0);
}

checkData();
