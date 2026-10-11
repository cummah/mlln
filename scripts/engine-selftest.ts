/**
 * engine-selftest.ts: read-only validation of lib/engine against live data.
 *   1. Causality: a value on date d is identical when every later bar is removed.
 *   2. Stability: a value is identical when older history outside its window is removed.
 *   3. Fidelity: weekly multipliers match the previous pipeline's stored weekly signals.
 * Run: npx ts-node --project tsconfig.scripts.json scripts/engine-selftest.ts [TICKER ...]
 */
import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { FREQ_CONFIG, WINDOW_BARS, MIN_BARS, type Bar, type Freq } from '../lib/engine/config'
import { evaluateAt, isEvaluationBar, attachVix } from '../lib/engine/evaluate'
import { volTimingAt, meanReversionAt, technicalsAt } from '../lib/engine/priceIndicators'
import { atrStops, shouldExit } from '../lib/engine/exits'

for (const line of fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf-8').split(/\r?\n/)) {
  const m = line.match(/^([^#=\s][^=]*)=(.*)/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function loadBars(ticker: string): Promise<Bar[]> {
  const rows: any[] = []
  for (let page = 0; ; page++) {
    const { data, error } = await sb
      .from('daily_prices')
      .select('date, open, high, low, close')
      .eq('ticker', ticker)
      .order('date', { ascending: true })
      .range(page * 1000, page * 1000 + 999)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < 1000) break
  }
  return rows
    .filter(r => r.close != null && r.open != null && r.high != null && r.low != null)
    .map(r => ({ date: r.date, open: +r.open, high: +r.high, low: +r.low, close: +r.close }))
}

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`)
}
const same = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b)

function snapshot(bars: Bar[], idx: number, freq: Freq) {
  return {
    eval: evaluateAt(bars, idx, FREQ_CONFIG[freq]),
    vol: volTimingAt(bars, idx),
    mr: meanReversionAt(bars, idx),
    tech: technicalsAt(bars, idx),
  }
}

async function main() {
  const tickers = process.argv.slice(2).length ? process.argv.slice(2) : ['AAPL', 'MSFT', 'NVDA', 'JPM', 'XOM']
  const vixBars = await loadBars('^VIX')
  const vixByDate = new Map(vixBars.map(b => [b.date, b.close]))
  console.log(`^VIX bars: ${vixBars.length}, newest ${vixBars[vixBars.length - 1]?.date}\n`)

  for (const ticker of tickers) {
    const bars = await loadBars(ticker)
    const { missing } = attachVix(bars, vixByDate)
    console.log(`== ${ticker}: ${bars.length} bars ${bars[0]?.date} to ${bars[bars.length - 1]?.date}, VIX missing ${missing}`)
    if (bars.length < WINDOW_BARS + 300) { console.log('   too short for stability test, skipped\n'); continue }

    // 1. Causality, all frequencies
    for (const freq of ['daily', 'weekly', 'monthly'] as Freq[]) {
      let bad = 0, n = 0
      for (let idx = MIN_BARS; idx < bars.length; idx += 37) {
        n++
        if (!same(snapshot(bars, idx, freq), snapshot(bars.slice(0, idx + 1), idx, freq))) bad++
      }
      check(`${ticker} causality ${freq} (${n} dates)`, bad === 0, bad ? `${bad} differ` : '')
    }

    // Volatility timing is exactly zero if and only if the day was not a down day
    {
      let zeroOnDown = 0, nonZeroOnUp = 0, n = 0
      for (let idx = MIN_BARS + 300; idx < bars.length; idx += 3) {
        const v = volTimingAt(bars, idx)
        if (v === null) continue
        n++
        const down = bars[idx].close < bars[idx - 1].close
        if (v === 0 && down) zeroOnDown++
        if (v !== 0 && !down) nonZeroOnUp++
      }
      check(`${ticker} vol timing is zero only on non-down days (${n} dates)`, zeroOnDown === 0 && nonZeroOnUp === 0, `zero on down day ${zeroOnDown}, non-zero on up day ${nonZeroOnUp}`)
    }

    // 2. Stability: drop 200 old bars, compare dates whose window starts after the cut
    let bad = 0, n = 0
    const cut = 200
    for (let idx = WINDOW_BARS + cut; idx < bars.length; idx += 29) {
      n++
      if (!same(snapshot(bars, idx, 'weekly'), snapshot(bars.slice(cut), idx - cut, 'weekly'))) bad++
    }
    check(`${ticker} stable when older history removed (${n} dates)`, bad === 0, bad ? `${bad} differ` : '')

    // 3. Fidelity vs previous pipeline, weekly
    const { data: old } = await sb.from('backtest_signals').select('signals_5y_weekly').eq('ticker', ticker).limit(1)
    const oldSigs: any[] = (old as any)?.[0]?.signals_5y_weekly ?? []
    const idxByDate = new Map(bars.map((b, i) => [b.date, i]))
    const recent = oldSigs.filter(s => s.date).slice(-80)
    let compared = 0, exact = 0, notEval = 0
    const diffs: string[] = []
    for (const s of recent) {
      const idx = idxByDate.get(s.date)
      if (idx === undefined) continue
      if (!isEvaluationBar(bars, idx, 'weekly')) { notEval++; continue }
      const c = evaluateAt(bars, idx, FREQ_CONFIG.weekly)
      if (!c) continue
      compared++
      const d = Math.abs(c.finalMult - (s.finalMult ?? 0))
      if (d < 0.02) exact++
      else if (diffs.length < 4) diffs.push(`${s.date} old ${(s.finalMult ?? 0).toFixed(3)} new ${c.finalMult.toFixed(3)} (rsi ${c.rsi.toFixed(1)}/${(s.rsi ?? NaN).toFixed?.(1)})`)
    }
    console.log(`   fidelity weekly: ${exact}/${compared} within 0.02x of previous pipeline, ${notEval} dates not a week start in new engine`)
    diffs.forEach(d => console.log('     differs: ' + d))

    // 4. Sample outputs
    const idx = bars.length - 1
    const snap = snapshot(bars, idx, 'weekly')
    console.log('   latest weekly components:', JSON.stringify({
      mult: +snap.eval!.finalMult.toFixed(3), rsi: +snap.eval!.rsi.toFixed(1), ema: +snap.eval!.emaMult.toFixed(3),
      dd: +snap.eval!.drawdownPct.toFixed(1), vix: snap.eval!.vix,
      vol: snap.vol, mr: snap.mr && { bonus: +snap.mr.bonus.toFixed(3), hl: snap.mr.halfLifeDays && +snap.mr.halfLifeDays.toFixed(1) },
      atrPct: snap.tech.atrPct && +snap.tech.atrPct.toFixed(2),
    }))
    const sampleIdx = bars.length - 120
    const stops = atrStops(bars, sampleIdx)
    console.log(`   ATR stops for a buy on ${bars[sampleIdx].date} @ close ${bars[sampleIdx].close.toFixed(2)}:`,
      stops.dates.map((d, j) => d ? `${d}` : '-').join(' | '))
    const ex = shouldExit(snap.eval!, FREQ_CONFIG.weekly)
    console.log(`   exit score today ${ex.score} (${ex.exit ? 'would exit' : 'hold'})\n`)
  }

  console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
