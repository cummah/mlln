import { loadAllBars } from '../lib/pipeline/bars'
import { loadEnv } from '../lib/pipeline/db'
import { attachVix } from '../lib/engine/evaluate'
import { summariseTicker } from '../lib/pipeline/summary'

loadEnv()

async function main() {
  console.log('Loading QQQ price data...')
  const bars = await loadAllBars('QQQ')

  console.log('Loading VIX...')
  const vix = await loadAllBars('^VIX')
  const vixByDate = new Map(vix.map(b => [b.date, b.close]))
  attachVix(bars, vixByDate)

  console.log(`\nComputing QQQ with assetType='etf'...`)
  const row = summariseTicker('QQQ', 'Invesco QQQ Trust', 'Technology', bars, 'etf')

  if (row) {
    console.log('\n✓ Backtest completed')
    console.log(`  5y invested (standard): $${row.std_invested_5y}`)
    console.log(`  5y invested (enhanced): $${row.enh_invested_5y}`)
    console.log(`  5y return (standard): ${row.std_return_5y}%`)
    console.log(`  5y return (enhanced): ${row.enh_return_5y}%`)
  } else {
    console.log('✗ No backtest results')
  }
}

main().catch(console.error)
