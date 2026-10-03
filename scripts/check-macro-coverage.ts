import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { count: activeCount } = await supabase
    .from('assets')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  const { count: metricsCount } = await supabase
    .from('asset_macro_metrics')
    .select('*', { count: 'exact', head: true })

  const { count: macroBtCount } = await supabase
    .from('asset_backtest_macro')
    .select('*', { count: 'exact', head: true })

  const { count: backtestSummaryCount } = await supabase
    .from('backtest_summary')
    .select('*', { count: 'exact', head: true })

  console.log('active assets:', activeCount)
  console.log('asset_macro_metrics rows:', metricsCount)
  console.log('asset_backtest_macro rows:', macroBtCount)
  console.log('backtest_summary rows:', backtestSummaryCount)

  // find active tickers missing from asset_macro_metrics
  const { data: activeAssets } = await supabase
    .from('assets')
    .select('ticker')
    .eq('is_active', true)

  const { data: metricsTickers } = await supabase
    .from('asset_macro_metrics')
    .select('ticker')

  const metricsSet = new Set((metricsTickers || []).map((r: any) => r.ticker))
  const missing = (activeAssets || []).filter((a: any) => !metricsSet.has(a.ticker)).map((a: any) => a.ticker)

  console.log(`\nMissing from asset_macro_metrics: ${missing.length}`)
  console.log(missing.slice(0, 50).join(', '))
}

main()
