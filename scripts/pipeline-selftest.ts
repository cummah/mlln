/**
 * pipeline-selftest.ts: read-only proof that the nightly delta equals a full recompute.
 * For many end dates T: build state with a full derive up to T-4, apply the nightly delta for the
 * next 4 nights, and require the result to equal a full derive up to T. Stored factor values must
 * never be rewritten, even when the factor function changes afterwards (a monthly refit).
 * Run: npx ts-node --project tsconfig.scripts.json scripts/pipeline-selftest.ts [TICKER ...]
 */
import { getDb, pagedSelect } from '../lib/pipeline/db'
import { attachVix } from '../lib/engine/evaluate'
import type { Bar, Freq } from '../lib/engine/config'
import { derive, startIndexFor, type ExitEventDb, type SignalRowDb } from '../lib/pipeline/derive'
import { nightlyDelta } from '../lib/pipeline/delta'

async function loadBars(ticker: string): Promise<Bar[]> {
  const rows = await pagedSelect<any>(`bars ${ticker}`, (from, to) =>
    getDb().from('daily_prices').select('date, open, high, low, close').eq('ticker', ticker).order('date', { ascending: true }).range(from, to))
  return rows.filter(r => r.close != null && r.open != null && r.high != null && r.low != null)
    .map(r => ({ date: r.date, open: +r.open, high: +r.high, low: +r.low, close: +r.close }))
}

const factorOld = (i: number) => ((i * 31) % 17) / 100 // factor value at creation time
const factorAfterRefit = (i: number) => 9 + i // what a later refit would wrongly say about the past

type State = { signals: Map<string, SignalRowDb>; events: Map<string, ExitEventDb> }
const sKey = (s: { ticker: string; freq: string; signal_date: string }) => `${s.ticker}|${s.freq}|${s.signal_date}`
const eKey = (e: { ticker: string; freq: string; event_date: string }) => `${e.ticker}|${e.freq}|${e.event_date}`

async function main() {
  const tickers = process.argv.slice(2).length ? process.argv.slice(2) : ['AAPL', 'JPM', 'XOM']
  const vix = await loadBars('^VIX')
  const vixByDate = new Map(vix.map(b => [b.date, b.close]))
  let failures = 0, scenarios = 0, rowsChecked = 0

  for (const ticker of tickers) {
    const bars = await loadBars(ticker)
    attachVix(bars, vixByDate)
    for (const freq of ['daily', 'weekly', 'monthly'] as Freq[]) {
      for (let T = bars.length - 1; T > bars.length - 90; T -= 3) {
        scenarios++
        // State as the backfill left it at T-4
        const base = T - 4
        const baseBars = bars.slice(0, base + 1)
        const f0 = derive(ticker, baseBars, freq, startIndexFor(baseBars, freq, baseBars[base].date), base, factorOld)
        const state: State = { signals: new Map(), events: new Map() }
        f0.signals.forEach(s => state.signals.set(sKey(s), { ...s }))
        f0.events.forEach(e => state.events.set(eKey(e), { ...e }))

        // Four nights of deltas, with the factor function changed after the base (a refit)
        for (let d = base + 1; d <= T; d++) {
          const upto = bars.slice(0, d + 1)
          const delta = nightlyDelta(ticker, upto, freq, bars[d - 1].date, i => (i > d - 1 ? factorOld(i) : factorAfterRefit(i)))
          delta.newSignals.forEach(s => state.signals.set(sKey(s), { ...s }))
          delta.patches.forEach(p => { const cur = state.signals.get(sKey(p)); if (cur) state.signals.set(sKey(p), { ...cur, ...p }) })
          delta.newEvents.forEach(e => state.events.set(eKey(e), { ...e }))
          delta.eventPatches.forEach(e => state.events.set(eKey(e), { ...e }))
        }

        // Full recompute up to T
        const full = derive(ticker, bars.slice(0, T + 1), freq, startIndexFor(bars.slice(0, T + 1), freq, bars[T].date), T, factorOld)
        const fullS = new Map(full.signals.map(s => [sKey(s), s]))
        const fullE = new Map(full.events.map(e => [eKey(e), e]))

        // The daily window moves forward: rows older than the new cutoff may remain in state, ignore them
        const cutoffOk = (date: string) => freq !== 'daily' || date >= bars[startIndexFor(bars.slice(0, T + 1), freq, bars[T].date)].date
        let bad = 0
        for (const [k, s] of Array.from(fullS.entries())) {
          rowsChecked++
          if (JSON.stringify(state.signals.get(k)) !== JSON.stringify(s)) { bad++; if (bad <= 2) console.log('  signal differs', k) }
        }
        for (const [k, s] of Array.from(state.signals.entries())) if (cutoffOk(s.signal_date) && !fullS.has(k)) { bad++; console.log('  extra signal', k) }
        for (const [k, e] of Array.from(fullE.entries())) {
          if (JSON.stringify(state.events.get(k)) !== JSON.stringify(e)) { bad++; if (bad <= 2) console.log('  event differs', k) }
        }
        for (const [k, e] of Array.from(state.events.entries())) if (cutoffOk(e.event_date) && !fullE.has(k)) { bad++; console.log('  extra event', k) }
        if (bad) { failures++; console.log(`FAIL ${ticker} ${freq} T=${bars[T].date}: ${bad} differences`) }
      }
    }
    console.log(`checked ${ticker}`)
  }
  console.log(`\n${scenarios} scenarios, ${rowsChecked} signal rows compared`)
  console.log(failures === 0 ? 'ALL CHECKS PASSED: nightly deltas equal a full recompute' : `${failures} SCENARIO(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
