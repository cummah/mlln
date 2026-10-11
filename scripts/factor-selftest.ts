/**
 * factor-selftest.ts: read-only validation of the walk-forward factor model on live prices.
 *   1. Causality: results for days up to T are identical when all data after T is removed.
 *   2. Fit isolation: a fit made on day F does not change if every close from F onward is altered.
 *   3. Reports fit time, universe size, first usable date, and old (leaky) vs new values.
 * Run: npx ts-node --project tsconfig.scripts.json scripts/factor-selftest.ts [universeSize]
 */
import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { fitFactors, walkForward, regimeAt, FIT_RETURNS, type CloseMatrix } from '../lib/engine/factors'

for (const line of fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf-8').split(/\r?\n/)) {
  const m = line.match(/^([^#=\s][^=]*)=(.*)/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function loadCloses(ticker: string): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  for (let page = 0; ; page++) {
    const { data, error } = await sb.from('daily_prices').select('date, close').eq('ticker', ticker)
      .order('date', { ascending: true }).range(page * 1000, page * 1000 + 999)
    if (error) throw error
    if (!data?.length) break
    for (const r of data as any[]) if (r.close != null) out.set(r.date, +r.close)
    if (data.length < 1000) break
  }
  return out
}

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`)
}

async function main() {
  const size = Number(process.argv[2] ?? 300)
  const { data: assets } = await sb.from('assets').select('ticker').eq('is_active', true).order('ticker').range(0, 1999)
  const tickers = (assets as any[]).map(a => a.ticker).filter((t: string) => !t.startsWith('^'))
  const step = Math.max(1, Math.floor(tickers.length / size))
  const sample = tickers.filter((_, i) => i % step === 0).slice(0, size)
  if (!sample.includes('SPY')) sample.push('SPY')

  console.log(`Loading ${sample.length} tickers...`)
  const raw = new Map<string, Map<string, number>>()
  for (let i = 0; i < sample.length; i += 8) {
    await Promise.all(sample.slice(i, i + 8).map(async t => raw.set(t, await loadCloses(t))))
  }

  const calendar = Array.from(raw.get('SPY')!.keys()).sort()
  const idx = new Map(calendar.map((d, i) => [d, i]))
  const closes: CloseMatrix = new Map()
  raw.forEach((m, t) => {
    const a = new Float64Array(calendar.length).fill(NaN)
    m.forEach((v, d) => { const i = idx.get(d); if (i !== undefined) a[i] = v })
    closes.set(t, a)
  })
  console.log(`Calendar ${calendar.length} days ${calendar[0]} to ${calendar[calendar.length - 1]}\n`)

  // Timing and basics
  const F = calendar.findIndex((d, i) => i > FIT_RETURNS + 1 && d.slice(0, 7) !== calendar[i - 1].slice(0, 7))
  let t0 = Date.now()
  const fit = fitFactors(calendar, closes, F)!
  console.log(`One fit on ${fit.loadings.size} tickers x ${FIT_RETURNS} returns took ${((Date.now() - t0) / 1000).toFixed(1)}s (fit date ${fit.fitDate})`)

  t0 = Date.now()
  const wf = walkForward(calendar, closes)
  const firstZ = wf.z.findIndex(z => z !== null)
  console.log(`Walk-forward: ${wf.fits.length} fits in ${((Date.now() - t0) / 1000).toFixed(1)}s, first usable z on ${calendar[firstZ]}\n`)
  check('walk-forward produced fits and values', wf.fits.length > 10 && firstZ > 0)

  // 1. Causality
  const T = calendar.length - 120
  const trunc: CloseMatrix = new Map()
  closes.forEach((a, t) => trunc.set(t, a.slice(0, T + 1)))
  const wfT = walkForward(calendar.slice(0, T + 1), trunc)
  let bad = 0, compared = 0
  for (let i = 0; i <= T; i++) {
    const a = wf.z[i], b = wfT.z[i]
    if ((a === null) !== (b === null)) { bad++; continue }
    if (a && b) { compared++; if (JSON.stringify(a) !== JSON.stringify(b)) bad++ }
  }
  check(`causality: z identical with data after ${calendar[T]} removed (${compared} days)`, bad === 0, bad ? `${bad} differ` : '')

  // 2. Fit isolation
  const altered: CloseMatrix = new Map()
  closes.forEach((a, t) => { const c = a.slice(); for (let i = F; i < c.length; i++) c[i] = (c[i] || 1) * (1 + ((i * 7919) % 13) / 10); altered.set(t, c) })
  const fit2 = fitFactors(calendar, altered, F)!
  let same = fit.loadings.size === fit2.loadings.size
  fit.loadings.forEach((l, t) => { if (JSON.stringify(l) !== JSON.stringify(fit2.loadings.get(t))) same = false })
  check(`fit isolation: loadings unchanged when every close from ${calendar[F]} onward is altered`, same)

  // 3. Old (full-sample) vs new values on recent weekly signals
  const { data: wk } = await sb.from('weekly_signal_enrichment').select('ticker, signals').in('ticker', sample.slice(0, 40))
  const rows: string[] = []
  for (const r of (wk as any[]) ?? []) {
    for (const s of r.signals ?? []) {
      if (!s.factorRegimeScore) continue // skip the zero/null rows, that is the bug being fixed
      const i = idx.get(s.date)
      if (i === undefined) continue
      const nv = regimeAt(wf, r.ticker, i)
      rows.push(`${r.ticker} ${s.date} old ${s.factorRegimeScore.toFixed(3)} new ${nv === null ? 'n/a' : nv.toFixed(3)}`)
    }
  }
  console.log(`\nOld (full-sample, non-zero) vs new walk-forward, ${rows.length} comparable signals, first 8:`)
  rows.slice(0, 8).forEach(r => console.log('  ' + r))

  // Coverage of the latest day
  const last = calendar.length - 1
  let have = 0, total = 0
  closes.forEach((_, t) => { total++; if (regimeAt(wf, t, last) !== null) have++ })
  console.log(`\nLatest day ${calendar[last]}: factor regime available for ${have}/${total} sampled tickers (rest need 95% coverage in the 2 year window)`)
  const vals: number[] = []
  closes.forEach((_, t) => { const v = regimeAt(wf, t, last); if (v !== null) vals.push(v) })
  vals.sort((a, b) => a - b)
  const zero = vals.filter(v => v === 0).length
  console.log(`  distribution: min ${vals[0].toFixed(3)}, median ${vals[Math.floor(vals.length / 2)].toFixed(3)}, max ${vals[vals.length - 1].toFixed(3)}, exact zeros ${zero}`)
  check('no mass of exact zeros on latest day', zero < vals.length * 0.05)

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch(e => { console.error(e); process.exit(1) })
