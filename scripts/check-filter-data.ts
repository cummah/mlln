import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

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
  // How varied is macro_regime_state across assets?
  const { data: scores } = await supabase
    .from('asset_scores')
    .select('asset_id, fundamental_quality_score, final_conviction_score, macro_regime_state')

  const rows = (scores as any[]) || []
  const regimes = new Map<string, number>()
  let nullFund = 0, nullConv = 0
  rows.forEach(r => {
    const key = r.macro_regime_state ?? 'NULL'
    regimes.set(key, (regimes.get(key) || 0) + 1)
    if (r.fundamental_quality_score == null) nullFund++
    if (r.final_conviction_score == null) nullConv++
  })
  console.log(`asset_scores rows: ${rows.length}`)
  console.log('macro_regime_state distribution:', Object.fromEntries(regimes))
  console.log(`null fundamental_quality_score: ${nullFund}, null final_conviction_score: ${nullConv}`)

  // Staleness of backtest_summary_macro overall
  const { data: macro } = await supabase
    .from('backtest_summary_macro')
    .select('ticker, updated_at, enh_purchases_5y, alpha_5y')
  const mrows = (macro as any[]) || []
  const zeroBuys = mrows.filter(r => (r.enh_purchases_5y || 0) === 0).length
  const zeroAlpha = mrows.filter(r => (r.alpha_5y || 0) === 0).length
  const newest = mrows.map(r => r.updated_at).sort().pop()
  console.log(`\nbacktest_summary_macro rows: ${mrows.length}`)
  console.log(`rows with enh_purchases_5y = 0: ${zeroBuys}`)
  console.log(`rows with alpha_5y = 0: ${zeroAlpha}`)
  console.log(`newest updated_at: ${newest}`)

  const alphaDist = mrows.filter(r => (r.alpha_5y || 0) !== 0).slice(0, 10)
  console.log('sample non-zero alpha rows:', alphaDist.map(r => `${r.ticker}:${r.alpha_5y}`).join(', '))
}

main()
