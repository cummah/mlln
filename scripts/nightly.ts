/**
 * nightly.ts: the one end-of-day job. Run once per evening after the US market closes.
 *
 *   npx ts-node --project tsconfig.scripts.json scripts/nightly.ts
 *   npx ts-node --project tsconfig.scripts.json scripts/nightly.ts --dry-run      (derive and check, write no signals)
 *   npx ts-node --project tsconfig.scripts.json scripts/nightly.ts --skip-prices  (use prices already stored)
 *
 * Order: prices, factor model, signals, integrity checks, write. If any integrity check fails,
 * no signal rows are written and the run exits non-zero, so wrong data never reaches the pages.
 * Safe to run twice: everything is keyed and derived from the stored bars.
 */
import { activeTickers, loadAllBars, loadMany, loadRecentBars } from '../lib/pipeline/bars'
import { getDb, loadEnv, pagedSelect, pool, recordRun, upsertChunks, withRetry } from '../lib/pipeline/db'
import { updatePrices } from '../lib/pipeline/prices'
import { factorStep, factorValue } from '../lib/pipeline/factorStep'
import { nightlyDelta } from '../lib/pipeline/delta'
import { DAILY_RETENTION_DAYS, type ExitEventDb, type SignalRowDb } from '../lib/pipeline/derive'
import { currentRow } from '../lib/pipeline/current'
import { runChecks, summarise } from '../lib/pipeline/checks'
import { attachVix } from '../lib/engine/evaluate'
import type { Bar, Freq } from '../lib/engine/config'

loadEnv()
const FREQS: Freq[] = ['daily', 'weekly', 'monthly']
const args = process.argv.slice(2)
const t0 = Date.now()
const lap = (msg: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s] ${msg}`)

async function main() {
  const started = new Date()
  const dry = args.includes('--dry-run')
  const db = getDb()
  const tickers = Array.from(new Set([...(await activeTickers()), 'SPY']))

  // 1. Prices
  let restated: string[] = []
  if (!args.includes('--skip-prices')) {
    const pr = await updatePrices([...tickers, '^VIX'], 6, (d, t) => lap(`prices ${d}/${t}`))
    restated = pr.restated
    lap(`prices: ${pr.newBars} new bars, ${pr.corrected.length} unfinished bars corrected, ${pr.restated.length} restated, ${pr.failed.length} failed`)
    pr.failed.slice(0, 10).forEach(f => console.log(`   failed ${f.ticker}: ${f.error.slice(0, 120)}`))
    await recordRun('prices', new Date().toISOString().slice(0, 10), pr.failed.length > tickers.length * 0.01 ? 'failed' : pr.failed.length ? 'partial' : 'ok',
      { newBars: pr.newBars, corrected: pr.corrected.length, restated: pr.restated, failed: pr.failed.slice(0, 50) }, started)
  }

  // 2. Recent bars for every ticker, and the full VIX map
  const bars = await loadMany(tickers, t => loadRecentBars(t, 1000), 8, (d, t) => lap(`loaded ${d}/${t}`))
  const vixAll = await loadAllBars('^VIX')
  const vixByDate = new Map(vixAll.map(b => [b.date, b.close]))
  const vixLastDate = vixAll.length ? vixAll[vixAll.length - 1].date : null
  const spy = bars.get('SPY')!
  const calendar = spy.map(b => b.date)
  const D = calendar[calendar.length - 1]
  bars.forEach(b => attachVix(b, vixByDate))
  lap(`latest trading day ${D}, ^VIX newest ${vixLastDate}`)

  // 3. Factor model
  const fstate = await factorStep(calendar, tickers)
  lap(`factor model: fit ${fstate.fitDate}${fstate.refit ? ' (refit tonight)' : ''}, ${fstate.newDays} new day(s)`)

  // 4. Work out what changed
  const marks = await pagedSelect<any>('current_signal', (from, to) => db.from('current_signal').select('ticker, freq, as_of').range(from, to))
  const watermark = new Map<string, string>(marks.map(r => [`${r.ticker}|${r.freq}`, r.as_of as string]))
  const restatedSet = new Set(restated)

  const newSignals: SignalRowDb[] = []
  const patches: any[] = []
  const events: ExitEventDb[] = []
  const current: any[] = []
  const rebuilt: string[] = []
  const lastBarDate = new Map<string, string>()

  await pool(tickers, 8, async ticker => {
    let b = bars.get(ticker) ?? []
    if (b.length === 0) return
    lastBarDate.set(ticker, b[b.length - 1].date)
    const factorAt = (series: Bar[]) => (i: number) => factorValue(fstate, ticker, series[i].date)

    // A ticker needs a full rebuild when it is new, was restated, or its watermark is no longer a stored bar
    const needsRebuild = FREQS.some(f => {
      const w = watermark.get(`${ticker}|${f}`)
      return restatedSet.has(ticker) || w === undefined || !b.some(x => x.date === w)
    })
    if (needsRebuild) {
      b = await loadAllBars(ticker)
      attachVix(b, vixByDate)
      rebuilt.push(ticker)
    }

    for (const freq of FREQS) {
      const w = restatedSet.has(ticker) ? null : (watermark.get(`${ticker}|${freq}`) ?? null)
      const useWm = needsRebuild && w !== null && !b.some(x => x.date === w) ? null : w
      if (useWm === null) {
        // Rebuilding: clear this ticker's rows for the frequency first
        if (!dry && watermark.has(`${ticker}|${freq}`)) {
          for (const t of ['buy_signals', 'exit_events']) {
            await withRetry(`clear ${t} ${ticker} ${freq}`, async () => { const { error } = await db.from(t).delete().eq('ticker', ticker).eq('freq', freq); if (error) throw new Error(error.message) })
          }
        }
      }
      const d = nightlyDelta(ticker, b, freq, useWm, factorAt(b))
      for (const s of d.newSignals) newSignals.push(s)
      for (const p of d.patches) patches.push(p)
      for (const e of d.newEvents) events.push(e)
      for (const e of d.eventPatches) events.push(e)
      const cur = currentRow(ticker, b, freq)
      if (cur) current.push(cur)
    }
  })
  lap(`derived ${newSignals.length} new signals, ${patches.length} patches, ${events.length} exit events, ${rebuilt.length} rebuilt tickers`)

  // 5. Integrity checks. Nothing is written if any fail.
  const results = runChecks({
    expectedDate: D,
    tickers,
    lastBarDate,
    vixLastDate,
    signals: newSignals,
    watchFromDate: new Date(new Date(D + 'T12:00:00Z').getTime() - 30 * 86400000).toISOString().slice(0, 10),
  })
  const { ok, text } = summarise(results)
  console.log('\n' + text + '\n')
  if (!ok) {
    await recordRun('signals', D, 'failed', { checks: results.filter(r => !r.ok) }, started)
    console.error('Integrity checks failed. No signal rows written.')
    process.exit(2)
  }
  if (dry) { lap('dry run complete, no signal rows written'); return }

  // 6. Write
  await upsertChunks('buy_signals', newSignals, 'ticker,freq,signal_date')
  await upsertChunks('buy_signals', patches, 'ticker,freq,signal_date')
  await upsertChunks('exit_events', events, 'ticker,freq,event_date')
  await upsertChunks('current_signal', current, 'ticker,freq')

  const cutoff = new Date(new Date(D + 'T12:00:00Z').getTime() - DAILY_RETENTION_DAYS * 86400000).toISOString().slice(0, 10)
  await withRetry('prune daily signals', async () => { const { error } = await db.from('buy_signals').delete().eq('freq', 'daily').lt('signal_date', cutoff); if (error) throw new Error(error.message) })
  await withRetry('prune daily exits', async () => { const { error } = await db.from('exit_events').delete().eq('freq', 'daily').lt('event_date', cutoff); if (error) throw new Error(error.message) })

  await recordRun('signals', D, 'ok', {
    newSignals: newSignals.length, patches: patches.length, events: events.length, rebuilt: rebuilt.length,
    factorFit: fstate.fitDate, factorRefit: fstate.refit,
  }, started)
  lap('nightly complete')
}

main().catch(async e => {
  console.error(e)
  try { await recordRun('nightly', new Date().toISOString().slice(0, 10), 'failed', { error: String(e?.message ?? e).slice(0, 500) }, new Date()) } catch { /* nothing more to do */ }
  process.exit(1)
})
