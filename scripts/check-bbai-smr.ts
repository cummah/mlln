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

async function check(ticker: string) {
  console.log(`\n=== ${ticker} ===`)

  const { data: asset, error: assetErr } = await supabase
    .from('assets')
    .select('id, ticker, sector, is_active, asset_type')
    .eq('ticker', ticker)
    .maybeSingle()
  console.log('assets:', asset, assetErr?.message)

  const { data: metrics, error: metricsErr } = await supabase
    .from('asset_macro_metrics')
    .select('ticker, metrics_computed_at, current_macro_regime')
    .eq('ticker', ticker)
    .maybeSingle()
  console.log('asset_macro_metrics:', metrics, metricsErr?.message)

  const { data: scores, error: scoresErr } = await supabase
    .from('asset_scores')
    .select('asset_id, dca_suitability_score, macro_regime_state')
    .eq('asset_id', asset?.id || -1)
    .maybeSingle()
  console.log('asset_scores:', scores, scoresErr?.message)

  const { data: backtest, error: btErr } = await supabase
    .from('backtest_summary')
    .select('ticker, enh_return_5y, std_return_5y')
    .eq('ticker', ticker)
    .maybeSingle()
  console.log('backtest_summary:', backtest, btErr?.message)

  const { data: macroBt, error: macroBtErr } = await supabase
    .from('asset_backtest_macro')
    .select('ticker, macro_return_5y')
    .eq('ticker', ticker)
    .maybeSingle()
  console.log('asset_backtest_macro:', macroBt, macroBtErr?.message)

  const { data: signals, error: sigErr } = await supabase
    .from('backtest_signals')
    .select('ticker, frequency')
    .eq('ticker', ticker)
    .eq('frequency', 'weekly')
    .limit(1)
  console.log('backtest_signals (weekly):', signals, sigErr?.message)
}

async function main() {
  await check('BBAI')
  await check('SMR')
}

main()
