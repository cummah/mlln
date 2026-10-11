/**
 * summary.ts: rebuilds the per-ticker backtest summary and DCA suitability score from the engine.
 *
 *   npx ts-node --project tsconfig.scripts.json scripts/summary.ts --dry-run
 *   npx ts-node --project tsconfig.scripts.json scripts/summary.ts                       (writes backtest_summary_v2)
 *   npx ts-node --project tsconfig.scripts.json scripts/summary.ts --target backtest_summary
 *
 * Uses the full price history, the same engine and the same fill prices as the signal pages. Nothing is
 * written unless the checks pass. By default it writes to a staging table so the portfolio page, which reads
 * backtest_summary, only changes when you decide to switch with --target backtest_summary.
 */
import { activeTickers, loadAllBars, loadMany } from '../lib/pipeline/bars'
import { getDb, loadEnv, pagedSelect, recordRun, upsertChunks } from '../lib/pipeline/db'
import { attachVix } from '../lib/engine/evaluate'
import { computeScores, type ScoreRow } from '../lib/pipeline/dcaScore'
import { summariseTicker, WINS } from '../lib/pipeline/summary'

loadEnv()
const args = process.argv.slice(2)
const t0 = Date.now()
const lap = (m: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s] ${m}`)
const targetIdx = args.indexOf('--target')
const TARGET = targetIdx >= 0 ? args[targetIdx + 1] : 'backtest_summary_v2'

async function main() {
  const started = new Date()
  const dry = args.includes('--dry-run')
  const db = getDb()

  const tickers = Array.from(new Set([...(await activeTickers()), 'SPY']))
  const meta = await pagedSelect<any>('assets', (f, t) => db.from('assets').select('ticker,name,sector').eq('is_active', true).range(f, t))
  const metaBy = new Map<string, any>(meta.map(m => [m.ticker, m]))
  lap(`${tickers.length} tickers, writing to ${dry ? '(dry run)' : TARGET}`)

  const bars = await loadMany(tickers, loadAllBars, 8, (d, t) => lap(`loaded ${d}/${t}`))
  const vix = await loadAllBars('^VIX')
  const vixByDate = new Map(vix.map(b => [b.date, b.close]))
  bars.forEach(b => attachVix(b, vixByDate))
  const latest = bars.get('SPY')![bars.get('SPY')!.length - 1].date
  const staleBefore = new Date(new Date(latest + 'T12:00:00Z').getTime() - 5 * 86400000).toISOString().slice(0, 10)
  lap(`prices loaded, latest trading day ${latest}`)

  const rows: Record<string, any>[] = []
  let stale = 0, short = 0
  bars.forEach((b, ticker) => {
    if (b.length === 0 || b[b.length - 1].date < staleBefore) { stale++; return }
    const m = metaBy.get(ticker)
    const row = summariseTicker(ticker, m?.name ?? ticker, m?.sector ?? 'Unknown', b)
    if (!row) { short++; return }
    rows.push(row)
  })
  lap(`summarised ${rows.length} tickers, ${stale} stale or delisted left out, ${short} with too little history`)

  const scores = computeScores(rows as unknown as ScoreRow[])
  rows.forEach(r => { r.dca_suitability_score = scores.get(r.ticker) ?? null })

  // Keep only columns the table has. The old summary table is the schema reference.
  const { data: ref, error: refErr } = await db.from('backtest_summary').select('*').limit(1)
  if (refErr || !ref?.length) throw new Error(`cannot read schema reference: ${refErr?.message ?? 'empty'}`)
  const allowed = new Set(Object.keys(ref[0]))
  const unknown = Object.keys(rows[0]).filter(k => !allowed.has(k))
  if (unknown.length) console.log(`   columns not in the table, skipped: ${unknown.join(', ')}`)
  const out = rows.map(r => Object.fromEntries(Object.entries(r).filter(([k]) => allowed.has(k))))

  // ── Integrity checks ──
  const checks: { name: string; ok: boolean; detail: string }[] = []
  const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail })
  add('enough tickers summarised', rows.length >= tickers.length * 0.85, `${rows.length} of ${tickers.length}`)
  const bad = out.filter(r => Object.values(r).some(v => typeof v === 'number' && !Number.isFinite(v)))
  add('all numbers finite', bad.length === 0, `${bad.length} rows with NaN or infinity`)
  const cov = (k: string) => out.filter(r => r[k] != null).length
  add('1y weekly window present for most tickers', cov('enh_return_1y') >= rows.length * 0.8, `${cov('enh_return_1y')} of ${rows.length}`)
  add('5y weekly window present for most tickers', cov('enh_return_5y') >= rows.length * 0.5, `${cov('enh_return_5y')} of ${rows.length}`)
  const sc = out.map(r => r.dca_suitability_score as number)
  add('scores in range', sc.every(s => s >= 1 && s <= 100), `min ${Math.min(...sc)}, max ${Math.max(...sc)}`)
  add('scores not all identical', new Set(sc).size > 20, `${new Set(sc).size} distinct values`)
  console.log('\n' + checks.map(c => `${c.ok ? 'PASS' : 'FAIL'}  ${c.name}: ${c.detail}`).join('\n') + '\n')

  console.log('window coverage (weekly | monthly):')
  for (const w of WINS) console.log(`  ${w}: ${cov(`enh_return_${w}`)} | ${cov(`monthly_enh_return_${w}`)} of ${rows.length}`)
  const a5 = out.map(r => r.alpha_5y).filter((x): x is number => x != null).sort((a, b) => a - b)
  if (a5.length) console.log(`weekly 5y alpha: median ${a5[a5.length >> 1]} pts, ${a5.filter(x => x > 0).length} of ${a5.length} beat standard`)
  console.log('score bands:', [[80, 100], [60, 79], [40, 59], [20, 39], [1, 19]].map(([a, b]) => `${a}-${b}: ${sc.filter(s => s >= a && s <= b).length}`).join(' | '))

  const outIdx = args.indexOf('--out')
  if (outIdx >= 0) { require('fs').writeFileSync(args[outIdx + 1], JSON.stringify(out)); lap(`rows saved to ${args[outIdx + 1]}`) }

  const ok = checks.every(c => c.ok)
  if (dry) { lap('dry run complete, nothing written'); process.exit(ok ? 0 : 2) }
  if (!ok) { await recordRun('summary', latest, 'failed', { checks: checks.filter(c => !c.ok) }, started); console.error('Checks failed, nothing written.'); process.exit(2) }

  await upsertChunks(TARGET, out, 'ticker', 100)
  await recordRun('summary', latest, 'ok', { table: TARGET, tickers: out.length }, started)
  lap(`wrote ${out.length} rows to ${TARGET}`)
}
main().catch(e => { console.error(e); process.exit(1) })
