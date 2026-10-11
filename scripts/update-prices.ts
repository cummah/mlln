/**
 * update-prices.ts: the price step of the nightly job, runnable on its own.
 * Fetches every active ticker plus ^VIX through the last completed trading day, corrects unfinished
 * last bars, rebuilds any ticker whose history was restated (split), and refreshes latest_prices.
 * Run: npx ts-node --project tsconfig.scripts.json scripts/update-prices.ts
 */
import { activeTickers } from '../lib/pipeline/bars'
import { recordRun } from '../lib/pipeline/db'
import { updatePrices } from '../lib/pipeline/prices'

async function main() {
  const started = new Date()
  const tickers = Array.from(new Set([...(await activeTickers()), 'SPY', '^VIX']))
  console.log(`updating ${tickers.length} tickers`)
  const r = await updatePrices(tickers, 6, (d, t) => console.log(`  ${d}/${t}`))

  let newest = ''
  r.latest.forEach(v => { if (v.date > newest) newest = v.date })
  console.log(`new bars ${r.newBars}, newest bar ${newest}`)
  console.log(`corrected unfinished bars: ${r.corrected.length}${r.corrected.length ? ' e.g. ' + r.corrected.slice(0, 10).join(', ') : ''}`)
  console.log(`restated (split) tickers: ${r.restated.length}${r.restated.length ? ' ' + r.restated.join(', ') : ''}`)
  console.log(`failed: ${r.failed.length}`)
  r.failed.slice(0, 25).forEach(f => console.log(`  ${f.ticker}: ${f.error}`))

  const ok = r.failed.length <= tickers.length * 0.01
  await recordRun('prices', newest || new Date().toISOString().slice(0, 10), ok ? (r.failed.length ? 'partial' : 'ok') : 'failed',
    { tickers: tickers.length, newBars: r.newBars, corrected: r.corrected.length, restated: r.restated, failed: r.failed.slice(0, 50) }, started)
  process.exit(ok ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
