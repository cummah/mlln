import { getSupabaseClient } from './lib/supabase'

async function checkMonthlyData() {
  const { data, error } = await getSupabaseClient()
    .from('backtest_summary')
    .select('ticker, monthly_std_invested_1y, monthly_enh_invested_1y, std_invested_1y, enh_invested_1y')
    .limit(5) as any

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('Sample data from backtest_summary:')
  data?.forEach((row: any) => {
    console.log(`${row.ticker}: std_monthly=${row.monthly_std_invested_1y}, enh_monthly=${row.monthly_enh_invested_1y}, std_weekly=${row.std_invested_1y}, enh_weekly=${row.enh_invested_1y}`)
  })
}

checkMonthlyData()
