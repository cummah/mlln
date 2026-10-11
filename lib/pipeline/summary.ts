// Backtest summary: standard against enhanced DCA over 1 month to 5 years, for weekly and monthly buying.
//
// One simulation feeds everything, with the same engine and fill prices as the signal pages, so the
// summary can never disagree with them. Standard DCA buys the base amount every period. Enhanced buys
// base times the multiplier, and skips the period when the multiplier is zero. Both fill at the next
// open plus slippage and are valued at the latest close. There is a single Standard baseline.

import { FREQ_CONFIG, type Bar, type Freq } from '../engine/config'
import { evaluateAt, isEvaluationBar } from '../engine/evaluate'

export type Win = '1m' | '3m' | '1y' | '3y' | '5y'
export const WINS: Win[] = ['1m', '3m', '1y', '3y', '5y']
export const BASE_AMOUNT: Record<'weekly' | 'monthly', number> = { weekly: 100, monthly: 433 }

export interface Period {
  date: string // evaluation date
  mult: number // zero means enhanced skips it
  entry: number // fill price, next open plus slippage
}

export interface WinResult {
  stdInvested: number
  enhInvested: number
  stdValue: number
  enhValue: number
  stdPurchases: number
  enhPurchases: number
  skipped: number
  stdShares: number
  enhShares: number
  stdAvgEntry: number | null
  enhAvgEntry: number | null
  stdReturn: number | null
  enhReturn: number | null
  alpha: number | null
}

/** Every evaluation period that has a following bar to fill on, with its multiplier. */
export function simulate(bars: Bar[], freq: 'weekly' | 'monthly'): Period[] {
  const cfg = FREQ_CONFIG[freq as Freq]
  const slip = cfg.slippagePct / 100
  const out: Period[] = []
  for (let i = 0; i < bars.length - 1; i++) {
    if (!isEvaluationBar(bars, i, freq)) continue
    const c = evaluateAt(bars, i, cfg)
    if (!c) continue
    out.push({ date: c.date, mult: c.finalMult, entry: bars[i + 1].open * (1 + slip) })
  }
  return out
}

/** First date of a window ending on `last`. */
export function windowStart(last: string, w: Win): string {
  const d = new Date(last + 'T12:00:00Z')
  if (w === '1m') d.setUTCMonth(d.getUTCMonth() - 1)
  else if (w === '3m') d.setUTCMonth(d.getUTCMonth() - 3)
  else d.setUTCFullYear(d.getUTCFullYear() - (w === '1y' ? 1 : w === '3y' ? 3 : 5))
  return d.toISOString().slice(0, 10)
}

const r2 = (v: number) => Math.round(v * 100) / 100

/**
 * Standard and enhanced results for the periods on or after `start`, valued at `lastClose`.
 * Null when the history does not reach back to the start of the window, so a recently listed stock
 * has no 5 year result rather than a quietly shortened one.
 */
export function aggregate(periods: Period[], base: number, lastClose: number, start: string, toleranceDays: number): WinResult | null {
  if (periods.length === 0) return null
  const tol = new Date(new Date(start + 'T12:00:00Z').getTime() + toleranceDays * 86400000).toISOString().slice(0, 10)
  if (periods[0].date > tol) return null
  const inWin = periods.filter(p => p.date >= start)
  if (inWin.length === 0) return null

  let stdInv = 0, stdSh = 0, enhInv = 0, enhSh = 0, enhN = 0
  for (const p of inWin) {
    stdInv += base
    stdSh += base / p.entry
    if (p.mult > 0) {
      const amt = base * p.mult
      enhInv += amt
      enhSh += amt / p.entry
      enhN++
    }
  }
  const stdVal = stdSh * lastClose
  const enhVal = enhSh * lastClose
  const stdRet = stdInv > 0 ? (stdVal / stdInv - 1) * 100 : null
  const enhRet = enhInv > 0 ? (enhVal / enhInv - 1) * 100 : null
  return {
    stdInvested: r2(stdInv),
    enhInvested: r2(enhInv),
    stdValue: r2(stdVal),
    enhValue: r2(enhVal),
    stdPurchases: inWin.length,
    enhPurchases: enhN,
    skipped: inWin.length - enhN,
    stdShares: Math.round(stdSh * 1e6) / 1e6,
    enhShares: Math.round(enhSh * 1e6) / 1e6,
    stdAvgEntry: stdSh > 0 ? r2(stdInv / stdSh) : null,
    enhAvgEntry: enhSh > 0 ? r2(enhInv / enhSh) : null,
    stdReturn: stdRet === null ? null : r2(stdRet),
    enhReturn: enhRet === null ? null : r2(enhRet),
    alpha: stdRet === null || enhRet === null ? null : r2(enhRet - stdRet),
  }
}

/** Summary table row for one ticker. Windows without enough history are left null. */
export function summariseTicker(ticker: string, name: string, sector: string, bars: Bar[]): Record<string, any> | null {
  if (bars.length < 300) return null
  const last = bars[bars.length - 1]
  const row: Record<string, any> = { ticker, name, sector, backtest_start: bars[0].date, updated_at: new Date().toISOString() }

  for (const freq of ['weekly', 'monthly'] as const) {
    const periods = simulate(bars, freq)
    const tol = freq === 'weekly' ? 10 : 40
    const p = freq === 'weekly' ? '' : 'monthly_'
    for (const w of WINS) {
      const r = aggregate(periods, BASE_AMOUNT[freq], last.close, windowStart(last.date, w), tol)
      const set = (k: string, v: number | null) => { row[`${p}${k}_${w}`] = v }
      set('std_return', r?.stdReturn ?? null)
      set('enh_return', r?.enhReturn ?? null)
      set('alpha', r?.alpha ?? null)
      set('std_invested', r?.stdInvested ?? null)
      set('enh_invested', r?.enhInvested ?? null)
      set('std_value', r?.stdValue ?? null)
      set('enh_value', r?.enhValue ?? null)
      set('std_purchases', r?.stdPurchases ?? null)
      set('enh_purchases', r?.enhPurchases ?? null)
      set('std_avg_entry', r?.stdAvgEntry ?? null)
      set('enh_avg_entry', r?.enhAvgEntry ?? null)
      set('std_shares', r?.stdShares ?? null)
      set('enh_shares', r?.enhShares ?? null)
      if (freq === 'monthly') row[`monthly_skipped_${w}`] = r?.skipped ?? null
    }
  }
  return row
}
