import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkData() {
  const { data, error } = await supabase
    .from('backtest_summary')
    .select('ticker, monthly_std_invested_1y, monthly_enh_invested_1y, std_invested_1y, enh_invested_1y')
    .limit(10)
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log('Database values:')
  console.log('================')
  data?.forEach(row => {
    console.log(`\n${row.ticker}:`)
    console.log(`  Weekly:  std=${row.std_invested_1y}, enh=${row.enh_invested_1y}`)
    console.log(`  Monthly: std=${row.monthly_std_invested_1y}, enh=${row.monthly_enh_invested_1y}`)
  })
}

checkData()
