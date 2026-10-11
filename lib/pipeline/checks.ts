// Data integrity checks. A run that fails any of these is recorded as failed and exits non-zero,
// so wrong data is stopped at the pipeline instead of being displayed. Each check exists because
// of a failure that actually happened in the old pipeline.

import type { SignalRowDb } from './derive'

export interface CheckResult {
  name: string
  ok: boolean
  detail: string
}

export interface CheckContext {
  expectedDate: string // latest trading day, taken from SPY
  tickers: string[] // active universe
  lastBarDate: Map<string, string> // newest stored bar per ticker
  vixLastDate: string | null
  signals: SignalRowDb[] // rows written or rewritten in this run
  watchFromDate: string // dates on or after this are "recent" for VIX and entry checks
}

function share(n: number, d: number): string {
  return d === 0 ? 'n/a' : `${((n / d) * 100).toFixed(1)}%`
}

export function runChecks(ctx: CheckContext): CheckResult[] {
  const out: CheckResult[] = []
  const add = (name: string, ok: boolean, detail: string) => out.push({ name, ok, detail })

  // Prices are current. The old pipeline silently lagged for days.
  const stale = ctx.tickers.filter(t => (ctx.lastBarDate.get(t) ?? '') < ctx.expectedDate)
  add('price coverage', stale.length <= ctx.tickers.length * 0.02,
    `${ctx.tickers.length - stale.length}/${ctx.tickers.length} tickers have a ${ctx.expectedDate} bar` +
    (stale.length ? `; stale e.g. ${stale.slice(0, 8).join(', ')}` : ''))

  // VIX is current. It silently stopped updating on 4 September and nothing noticed.
  add('vix current', ctx.vixLastDate === ctx.expectedDate, `^VIX newest bar ${ctx.vixLastDate ?? 'none'}, expected ${ctx.expectedDate}`)
  const recent = ctx.signals.filter(s => s.signal_date >= ctx.watchFromDate)
  const vixMissing = recent.filter(s => s.vix === null).length
  add('vix present on recent signals', vixMissing === 0, `${vixMissing} of ${recent.length} recent signals have no VIX value`)

  // Values are in range. A bad indicator should fail loudly, not display.
  const bad = (pred: (s: SignalRowDb) => boolean) => ctx.signals.filter(pred).length
  const nRange = bad(s => !(s.mult > 0 && s.mult <= 6) || s.rsi < 0 || s.rsi > 100 ||
    (s.factor_regime !== null && Math.abs(s.factor_regime) > 0.4 + 1e-9) ||
    (s.vol_timing !== null && Math.abs(s.vol_timing) > 0.3 + 1e-9) ||
    (s.mean_reversion !== null && Math.abs(s.mean_reversion) > 0.3 + 1e-9) ||
    [s.rsi, s.ema_dist_pct, s.drawdown_pct, s.mult].some(v => !Number.isFinite(v)))
  add('values in range', nRange === 0, `${nRange} of ${ctx.signals.length} rows outside valid ranges`)

  // No wall of zeros in a column. This is the factor regime bug that showed 3,142 zeros of 4,551.
  for (const col of ['factor_regime', 'vol_timing', 'mean_reversion'] as const) {
    const byDate = new Map<string, { zero: number; total: number }>()
    for (const s of ctx.signals) {
      const v = s[col]
      if (v === null) continue
      const g = byDate.get(s.signal_date) ?? { zero: 0, total: 0 }
      g.total++
      if (v === 0) g.zero++
      byDate.set(s.signal_date, g)
    }
    // vol_timing is legitimately zero on up days, so only the factor and reversion columns are strict
    const limit = col === 'vol_timing' ? 0.98 : 0.1
    const offenders = Array.from(byDate.entries()).filter(([, g]) => g.total >= 40 && g.zero / g.total > limit)
    add(`no mass of zeros in ${col}`, offenders.length === 0,
      offenders.length ? `dates with too many exact zeros: ${offenders.slice(0, 4).map(([d, g]) => `${d} (${share(g.zero, g.total)})`).join(', ')}` : 'ok')
  }

  // Entry prices fill in the next day, so only the newest bar may lack one.
  const noEntry = ctx.signals.filter(s => s.entry_price === null && s.signal_date < ctx.expectedDate)
  add('entry prices filled', noEntry.length === 0, `${noEntry.length} signals older than ${ctx.expectedDate} have no entry price`)

  return out
}

export function summarise(results: CheckResult[]): { ok: boolean; text: string } {
  const ok = results.every(r => r.ok)
  return { ok, text: results.map(r => `${r.ok ? 'PASS' : 'FAIL'}  ${r.name}: ${r.detail}`).join('\n') }
}
