/**
 * refresh-vix.ts: bring ^VIX (and SPY) up to date using the same code the nightly job uses.
 * Writes only new ^VIX and SPY bars to daily_prices, plus their rows in latest_prices.
 * Run: npx ts-node --project tsconfig.scripts.json scripts/refresh-vix.ts
 */
import { updatePrices } from '../lib/pipeline/prices'

async function main() {
  const r = await updatePrices(['^VIX', 'SPY'], 2)
  console.log('new bars written:', r.newBars)
  console.log('restated:', r.restated)
  console.log('corrected unfinished bars:', r.corrected)
  console.log('failed:', r.failed)
  r.latest.forEach((v, t) => console.log(t, 'newest bar', v.date, 'close', v.close.toFixed(2)))
  process.exit(r.failed.length ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })
