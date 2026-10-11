/**
 * backfill.ts: one-time (or rebuild) replay of the full signal history into the new tables.
 *
 *   npx ts-node --project tsconfig.scripts.json scripts/backfill.ts --dry-run
 *   npx ts-node --project tsconfig.scripts.json scripts/backfill.ts --reset
 *   npx ts-node --project tsconfig.scripts.json scripts/backfill.ts --dry-run --tickers AAPL,MSFT,SPY
 *
 * Every signal is derived from bars up to its own date only, factor regime comes from the
 * walk-forward model, and nothing is written unless the integrity checks pass. Writes go to the new
 * tables only. daily_prices, assets and backtest_summary are read, never changed.
 */
import { getDb, loadEnv, recordRun, upsertChunks, withRetry } from '../lib/pipeline/db'
import { activeTickers, loadAllBars, loadMany } from '../lib/pipeline/bars'
import { derive, startIndexFor, type ExitEventDb, type SignalRowDb } from '../lib/pipeline/derive'
import { runChecks, summarise } from '../lib/pipeline/checks'
import { attachVix } from '../lib/engine/evaluate'
import { currentRow } from '../lib/pipeline/current'
import type { Freq } from '../lib/engine/config'
import {
  loadingRows, regimeAt, seriesRows, walkForward,
  type CloseMatrix, type FactorFit,
} from '../lib/engine/factors'

loadEnv()
const args = process.argv.slice(2)
const flag = (f: string) => args.includes(f)
const opt = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null }
const FREQS: Freq[] = ['daily', 'weekly', 'monthly']
const t0 = Date.now()
const lap = (msg: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s] ${msg}`)

async function main() {
  const started = new Date()
  const dry = flag('--dry-run')
  const subset = opt('--tickers')?.split(',').map(s => s.trim().toUpperCase())

  let universe = subset ?? (await activeTickers())
  if (!universe.includes('SPY')) universe = ['SPY', ...universe]
  lap(`universe ${universe.length} tickers${dry ? ' (dry run, no writes)' : ''}`)

  // 1. Prices
  const bars = await loadMany(universe, loadAllBars, 8, (d, t) => lap(`loaded ${d}/${t}`))
  const vixBars = await loadAllBars('^VIX')
  const vixByDate = new Map(vixBars.map(b => [b.date, b.close]))
  const vixLastDate = vixBars.length ? vixBars[vixBars.length - 1].date : null
  const spy = bars.get('SPY')!
  if (spy.length < 300) throw new Error('SPY history missing or too short')
  const expectedDate = spy[spy.length - 1].date
  lap(`prices loaded, expected last trading day ${expectedDate}, ^VIX newest ${vixLastDate}`)

  let vixMissingBars = 0
  bars.forEach(b => { vixMissingBars += attachVix(b, vixByDate).missing })
  lap(`VIX attached, ${vixMissingBars} bars have no VIX within 5 days`)

  // 2. Walk-forward factor model on the SPY calendar
  const calendar = spy.map(b => b.date)
  const calIdx = new Map(calendar.map((d, i) => [d, i]))
  const closes: CloseMatrix = new Map()
  bars.forEach((b, t) => {
    const a = new Float64Array(calendar.length).fill(NaN)
    for (const bar of b) { const i = calIdx.get(bar.date); if (i !== undefined) a[i] = bar.close }
    closes.set(t, a)
  })
  let lastFit = null as FactorFit | null
  let lastFitIdx = -1
  const wf = walkForward(calendar, closes, (f, idx) => { lastFit = f; lastFitIdx = idx })
  const firstZ = wf.z.findIndex(z => z !== null)
  lap(`factor model: ${wf.fits.length} monthly fits, first usable ${firstZ >= 0 ? calendar[firstZ] : 'none'}`)

  // 3. Derive signals and exit events
  const signals: SignalRowDb[] = []
  const events: ExitEventDb[] = []
  const current: any[] = []
  const lastBarDate = new Map<string, string>()
  let done = 0
  bars.forEach((b, ticker) => {
    if (b.length === 0) return
    lastBarDate.set(ticker, b[b.length - 1].date)
    const factorAt = (i: number) => {
      const ci = calIdx.get(b[i].date)
      return ci === undefined ? null : regimeAt(wf, ticker, ci)
    }
    for (const freq of FREQS) {
      const r = derive(ticker, b, freq, startIndexFor(b, freq, expectedDate), b.length - 1, factorAt)
      for (const s of r.signals) signals.push(s)
      for (const e of r.events) events.push(e)
      const cur = currentRow(ticker, b, freq)
      if (cur) current.push(cur)
    }
    if (++done % 250 === 0) lap(`derived ${done}/${bars.size}`)
  })
  lap(`derived ${signals.length} signals, ${events.length} exit events, ${current.length} current signals`)

  // 4. Integrity checks before anything is written
  const results = runChecks({
    expectedDate,
    tickers: universe,
    lastBarDate,
    vixLastDate,
    signals,
    watchFromDate: new Date(new Date(expectedDate + 'T12:00:00Z').getTime() - 30 * 86400000).toISOString().slice(0, 10),
  })
  const { ok, text } = summarise(results)
  console.log('\n' + text + '\n')

  // Distribution report, so nothing is trusted blind
  report(signals)

  if (dry) { lap('dry run complete, nothing written'); process.exit(ok ? 0 : 2) }
  if (!ok && !flag('--force')) {
    await recordRun('backfill', expectedDate, 'failed', { checks: results.filter(r => !r.ok) }, started)
    console.error('Integrity checks failed. Nothing written. Fix the cause, or pass --force to write anyway.')
    process.exit(2)
  }

  // 5. Write
  const db = getDb()
  if (flag('--reset')) {
    lap('clearing new tables')
    for (const t of ['buy_signals', 'exit_events', 'current_signal']) {
      await withRetry(`clear ${t}`, async () => { const { error } = await db.from(t).delete().neq('ticker', ''); if (error) throw new Error(error.message) })
    }
  }
  await upsertChunks('buy_signals', signals, 'ticker,freq,signal_date'); lap(`wrote ${signals.length} signals`)
  await upsertChunks('exit_events', events, 'ticker,freq,event_date'); lap(`wrote ${events.length} exit events`)
  await upsertChunks('current_signal', current, 'ticker,freq'); lap(`wrote ${current.length} current signals`)

  const latest: any[] = []
  bars.forEach((b, ticker) => {
    if (b.length < 2) return
    latest.push({ ticker, price_date: b[b.length - 1].date, close: b[b.length - 1].close, prev_close: b[b.length - 2].close })
  })
  await upsertChunks('latest_prices', latest, 'ticker'); lap(`wrote ${latest.length} latest prices`)

  if (lastFit) {
    const fit = lastFit as FactorFit
    await withRetry('clear factor_loadings', async () => { const { error } = await db.from('factor_loadings').delete().neq('ticker', ''); if (error) throw new Error(error.message) })
    const loadRows = loadingRows(fit)
    await upsertChunks('factor_loadings', loadRows, 'ticker')

    const seriesOut = seriesRows(fit, calendar, closes, lastFitIdx)
    await withRetry('clear factor_series', async () => { const { error } = await db.from('factor_series').delete().gte('date', '1900-01-01'); if (error) throw new Error(error.message) })
    await upsertChunks('factor_series', seriesOut, 'date')
    lap(`wrote ${loadRows.length} factor loadings and ${seriesOut.length} factor series rows (fit ${fit.fitDate})`)
  }

  await recordRun('backfill', expectedDate, 'ok', { signals: signals.length, events: events.length, tickers: bars.size }, started)
  lap('backfill complete')

}

function report(signals: SignalRowDb[]) {
  for (const freq of FREQS) {
    const rows = signals.filter(s => s.freq === freq)
    if (!rows.length) continue
    const dates = rows.map(r => r.signal_date).sort()
    const nn = (f: (r: SignalRowDb) => number | null) => rows.filter(r => f(r) === null).length
    const zero = (f: (r: SignalRowDb) => number | null) => rows.filter(r => f(r) === 0).length
    const pc = (n: number) => `${((n / rows.length) * 100).toFixed(1)}%`
    console.log(`${freq.padEnd(7)} ${String(rows.length).padStart(7)} rows ${dates[0]} to ${dates[dates.length - 1]}  ` +
      `factor null ${pc(nn(r => r.factor_regime))} zero ${pc(zero(r => r.factor_regime))} | ` +
      `volTiming null ${pc(nn(r => r.vol_timing))} zero ${pc(zero(r => r.vol_timing))} | ` +
      `meanRev null ${pc(nn(r => r.mean_reversion))} zero ${pc(zero(r => r.mean_reversion))} | vix null ${pc(nn(r => r.vix))}`)
  }
  console.log('')
}

main().catch(e => { console.error(e); process.exit(1) })
