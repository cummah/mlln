/**
 * Shared DCA backtest arithmetic for the Macro model, used by both the batch script
 * (scripts/compute-macro-backtest.ts, which writes backtest_summary_macro) and the live
 * API route (app/api/asset/[ticker]/macro-backtest/route.ts, which recomputes on demand
 * when the Factor Tilt / Volatility Timing toggles change). Keeping the math in one place
 * guarantees the "both toggles on" live result always matches the precomputed baseline,
 * instead of two independently-maintained implementations quietly drifting apart.
 */

export const WEEKLY_BASE = 100
export const MONTHLY_BASE = 433

export const round2 = (n: number) => Math.round(n * 100) / 100
export const clamp = (n: number, max: number) => Math.max(-max, Math.min(max, n))

export interface WeightedBuy {
  date: string
  close: number
  factorModifier: number
  volBonus: number
  meanReversionBonus: number
}

export interface ModifierToggles {
  factor: boolean
  vol: boolean
  meanReversion: boolean
}

// Multiplicative composition, same convention as Enhanced's finalMult chain in lib/dcaEngine.ts.
export function combineModifiers(
  factorModifier: number,
  volBonus: number,
  meanReversionBonus: number,
  toggles: ModifierToggles = { factor: true, vol: true, meanReversion: true }
): number {
  const f = toggles.factor ? factorModifier : 0
  const v = toggles.vol ? volBonus : 0
  const m = toggles.meanReversion ? meanReversionBonus : 0
  return (1 + f) * (1 + v) * (1 + m) - 1
}

export interface LegResult {
  invested: number
  value: number
  returnPct: number
  purchases: number
  avgEntry: number
  shares: number
}

// Run std + macro legs over the same buy dates
export function runBacktest(
  buys: Array<{ date: string; close: number; modifier: number }>,
  latestClose: number,
  base: number
): { std: LegResult; enh: LegResult } {
  let stdInvested = 0, stdShares = 0
  let enhInvested = 0, enhShares = 0

  for (const b of buys) {
    stdInvested += base
    stdShares += base / b.close

    const mult = Math.max(0, 1 + b.modifier)
    const amt = base * mult
    enhInvested += amt
    enhShares += amt / b.close
  }

  const mk = (invested: number, shares: number): LegResult => {
    const value = shares * latestClose
    return {
      // clamp to the table's NUMERIC precision: values/invested 12,2 — returns/alpha 10,2 — shares 10,2
      invested: clamp(round2(invested), 9.99e9),
      value: clamp(round2(value), 9.99e9),
      returnPct: invested > 0 ? clamp(round2(((value - invested) / invested) * 100), 9.99e7) : 0,
      purchases: buys.length,
      avgEntry: shares > 0 ? clamp(round2(invested / shares), 9.99e7) : 0,
      shares: clamp(round2(shares), 9.99e7),
    }
  }

  return { std: mk(stdInvested, stdShares), enh: mk(enhInvested, enhShares) }
}

export type BacktestWindow = '1m' | '3m' | '1y' | '3y' | '5y'

export function computeWindowStarts(now: Date = new Date()): Record<BacktestWindow, string> {
  const windowStart = (years: number, months = 0): string => {
    const d = new Date(now)
    if (years) d.setFullYear(d.getFullYear() - years)
    if (months) d.setMonth(d.getMonth() - months)
    return d.toISOString().split('T')[0]
  }
  return {
    '1m': windowStart(0, 1),
    '3m': windowStart(0, 3),
    '1y': windowStart(1),
    '3y': windowStart(3),
    '5y': windowStart(5),
  }
}

export interface WindowResult { std: LegResult; enh: LegResult }
export interface BacktestResultSet {
  weekly: Record<BacktestWindow, WindowResult>
  monthly: Record<BacktestWindow, WindowResult>
}

function applyToggles(buys: WeightedBuy[], toggles: ModifierToggles): Array<{ date: string; close: number; modifier: number }> {
  return buys.map(b => ({ date: b.date, close: b.close, modifier: combineModifiers(b.factorModifier, b.volBonus, b.meanReversionBonus, toggles) }))
}

// Runs both cadences across all 5 windows for a given toggle state. This is the one function
// both the batch script and the live API call, so "both toggles on" is always identical to
// whatever's precomputed in backtest_summary_macro.
export function buildBacktestResults(
  weeklyBuys: WeightedBuy[],
  monthlyBuys: WeightedBuy[],
  latestClose: number,
  toggles: ModifierToggles,
  now: Date = new Date()
): BacktestResultSet {
  const windows = computeWindowStarts(now)
  const weeklyModified = applyToggles(weeklyBuys, toggles)
  const monthlyModified = applyToggles(monthlyBuys, toggles)

  const weekly = {} as Record<BacktestWindow, WindowResult>
  const monthly = {} as Record<BacktestWindow, WindowResult>
  for (const win of Object.keys(windows) as BacktestWindow[]) {
    const start = windows[win]
    weekly[win] = runBacktest(weeklyModified.filter(b => b.date >= start), latestClose, WEEKLY_BASE)
    monthly[win] = runBacktest(monthlyModified.filter(b => b.date >= start), latestClose, MONTHLY_BASE)
  }
  return { weekly, monthly }
}

const AVG_ENTRY_WINDOWS: BacktestWindow[] = ['1y', '3y', '5y']

// Flattens a BacktestResultSet into the camelCase field names lib/backtest-summary.ts's
// BacktestSummary interface uses (e.g. stdInvested5y, monthlyAlpha3y) - a drop-in partial
// BacktestSummary, so the client can spread it directly with no field-name mapping.
export function buildBacktestSummaryFields(results: BacktestResultSet): Record<string, number> {
  const fields: Record<string, number> = {}
  for (const win of Object.keys(results.weekly) as BacktestWindow[]) {
    const w = results.weekly[win]
    const m = results.monthly[win]

    fields[`stdReturn${win}`] = w.std.returnPct
    fields[`enhReturn${win}`] = w.enh.returnPct
    fields[`alpha${win}`] = round2(w.enh.returnPct - w.std.returnPct)
    fields[`stdInvested${win}`] = w.std.invested
    fields[`enhInvested${win}`] = w.enh.invested
    fields[`stdValue${win}`] = w.std.value
    fields[`enhValue${win}`] = w.enh.value
    fields[`stdPurchases${win}`] = w.std.purchases
    fields[`enhPurchases${win}`] = w.enh.purchases

    fields[`monthlyStdReturn${win}`] = m.std.returnPct
    fields[`monthlyEnhReturn${win}`] = m.enh.returnPct
    fields[`monthlyAlpha${win}`] = round2(m.enh.returnPct - m.std.returnPct)
    fields[`monthlyStdInvested${win}`] = m.std.invested
    fields[`monthlyEnhInvested${win}`] = m.enh.invested
    fields[`monthlyStdValue${win}`] = m.std.value
    fields[`monthlyEnhValue${win}`] = m.enh.value

    if (AVG_ENTRY_WINDOWS.includes(win)) {
      fields[`stdAvgEntry${win}`] = w.std.avgEntry
      fields[`enhAvgEntry${win}`] = w.enh.avgEntry
      fields[`stdShares${win}`] = w.std.shares
      fields[`enhShares${win}`] = w.enh.shares
      fields[`monthlyStdAvgEntry${win}`] = m.std.avgEntry
      fields[`monthlyEnhAvgEntry${win}`] = m.enh.avgEntry
    }
  }
  return fields
}
