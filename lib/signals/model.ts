// Pure calculations behind the signal pages. No React, no database.
// Everything here is covered by scripts/signals-selftest.ts.

import { isoWeekKey } from '../engine/evaluate'
import { RANGES } from './config'
import type { Effective, Filters, Freq, SigRow, Strategy, TickerInfo } from './types'

// ─── Filters ────────────────────────────────────────────────────────────────────────────────

/** A slider only filters once it is narrower than its full range, so rows with no value stay visible by default. */
function outside(v: number | null, range: [number, number], full: [number, number]): boolean {
  const narrowedLo = range[0] > full[0]
  const narrowedHi = range[1] < full[1]
  if (!narrowedLo && !narrowedHi) return false
  if (v === null) return true
  return (narrowedLo && v < range[0]) || (narrowedHi && v > range[1])
}

export function applyFilters(rows: SigRow[], tickers: TickerInfo[], f: Filters): SigRow[] {
  const q = f.search.trim().toUpperCase()
  const sectors = f.sectors.length ? new Set(f.sectors) : null
  const year = f.year === null ? null : String(f.year)
  return rows.filter(r => {
    const t = tickers[r.i]
    if (q && !t.ticker.toUpperCase().includes(q) && !t.name.toUpperCase().includes(q)) return false
    if (sectors && !sectors.has(t.sector)) return false
    if (f.dateFrom && r.d < f.dateFrom) return false
    if (year && r.d.slice(0, 4) !== year) return false
    if (outside(r.m, f.mult, RANGES.mult)) return false
    if (outside(t.dca, f.dca, RANGES.dca)) return false
    if (outside(r.f === null ? null : r.f * 100, f.factor, RANGES.factor)) return false
    // Volatility timing only exists on down days, so a narrowed slider keeps only actual dips
    if (outside(r.v === null || r.v === 0 ? null : r.v * 100, f.vol, RANGES.vol)) return false
    if (outside(r.r === null ? null : r.r * 100, f.mr, RANGES.mr)) return false
    if (outside(r.a, f.atr, RANGES.atr)) return false
    if (f.weeklyAligned && r.wa === null) return false
    if (f.monthlyAligned && r.ma === null) return false
    return true
  })
}

// ─── Exits ──────────────────────────────────────────────────────────────────────────────────

/**
 * What happens to a signal under a strategy. Buy and hold never sells. Sell mode closes it at the
 * exit signal (if its score is inside the chosen range) or at the ATR stop, whichever came first.
 * A return that cannot be known yet, such as a next-open sale that has not opened, is reported as
 * still open rather than guessed.
 */
export function effective(r: SigRow, s: Strategy): Effective {
  if (s.mode === 'hold') return { closed: false, date: null, retPct: r.p, reason: null }

  let sigDate: string | null = null
  let sigRet: number | null = null
  if (r.xd && r.xs !== null && r.xs >= s.minExit && r.xs <= s.maxExit) {
    const ret = s.nextOpen ? r.xn : r.xr
    if (ret !== null) { sigDate = r.xd; sigRet = ret }
  }

  let atrDate: string | null = null
  let atrRet: number | null = null
  if (s.atrIdx !== null && r.sd && r.sr) {
    atrDate = r.sd[s.atrIdx] ?? null
    atrRet = r.sr[s.atrIdx] ?? null
    if (atrDate === null || atrRet === null) { atrDate = null; atrRet = null }
  }

  if (sigDate === null && atrDate === null) return { closed: false, date: null, retPct: r.p, reason: null }
  if (sigDate !== null && (atrDate === null || sigDate <= atrDate)) return { closed: true, date: sigDate, retPct: sigRet, reason: 'signal' }
  return { closed: true, date: atrDate, retPct: atrRet, reason: 'atr' }
}

// ─── SPY benchmark: the same dollars into SPY on the same dates ─────────────────────────────

export type SpyReturn = (date: string) => number | null

export function makeSpy(dates: string[], closes: number[]): SpyReturn {
  const latest = closes.length ? closes[closes.length - 1] : null
  return (date: string) => {
    if (latest === null || dates.length === 0 || date < dates[0]) return null
    let lo = 0
    let hi = dates.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (dates[mid] <= date) lo = mid
      else hi = mid - 1
    }
    return closes[lo] > 0 ? (latest / closes[lo] - 1) * 100 : null
  }
}

// ─── Statistics ─────────────────────────────────────────────────────────────────────────────

export interface HoldStats {
  n: number
  invested: number
  value: number
  returnPct: number | null
  avgPct: number | null
  medianPct: number | null
  wins: number
  winRate: number | null
}

export interface SellStats {
  closedCount: number
  openCount: number
  closedProfit: number
  openProfit: number
  avgHoldDays: number | null
  minCapital: number
  endingValue: number
  returnOnCapital: number | null
  winRate: number | null
  byAtr: number
  bySignal: number
}

export interface Stats {
  count: number // rows shown
  pending: number // rows whose entry price is not known yet, left out of the figures below
  hold: HoldStats
  spy: { value: number; returnPct: number | null; deltaPct: number | null; n: number }
  sell: SellStats | null
  avgMult: number | null
}

const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00Z').getTime() - new Date(a + 'T12:00:00Z').getTime()) / 86400000)
}

export function computeStats(rows: SigRow[], base: number, strat: Strategy, spy: SpyReturn): Stats {
  const known = rows.filter(r => r.p !== null)
  const pending = rows.length - known.length

  // Buy and hold
  let invested = 0
  let value = 0
  const rets: number[] = []
  let spyValue = 0
  let spyInvested = 0
  let multSum = 0
  for (const r of known) {
    const inv = base * r.m
    invested += inv
    value += inv * (1 + (r.p as number) / 100)
    rets.push(r.p as number)
    multSum += r.m
    const sr = spy(r.d)
    if (sr !== null) { spyInvested += inv; spyValue += inv * (1 + sr / 100) }
  }
  const wins = rets.filter(x => x >= 0).length
  const returnPct = invested > 0 ? (value / invested - 1) * 100 : null
  const spyReturnPct = spyInvested > 0 ? (spyValue / spyInvested - 1) * 100 : null
  // The comparison is only fair on the rows SPY could be measured for
  const heldOnSpyRows = spyInvested > 0
    ? (known.reduce((a, r) => (spy(r.d) === null ? a : a + base * r.m * (1 + (r.p as number) / 100)), 0) / spyInvested - 1) * 100
    : null

  const hold: HoldStats = {
    n: known.length,
    invested,
    value,
    returnPct,
    avgPct: rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : null,
    medianPct: median(rets),
    wins,
    winRate: rets.length ? (wins / rets.length) * 100 : null,
  }

  // Sell on signal
  let sell: SellStats | null = null
  if (strat.mode === 'sell') {
    const events: { date: string; amount: number }[] = []
    let closedProfit = 0
    let openProfit = 0
    let openValue = 0
    let closedCount = 0
    let openCount = 0
    let byAtr = 0
    let bySignal = 0
    const holdDays: number[] = []
    const sellRets: number[] = []
    for (const r of known) {
      const inv = base * r.m
      const eff = effective(r, strat)
      events.push({ date: r.d, amount: -inv })
      if (eff.closed && eff.retPct !== null && eff.date) {
        const proceeds = inv * (1 + eff.retPct / 100) - strat.fee
        events.push({ date: eff.date, amount: proceeds })
        closedProfit += proceeds - inv
        closedCount++
        holdDays.push(daysBetween(r.d, eff.date))
        sellRets.push(eff.retPct)
        if (eff.reason === 'atr') byAtr++
        else bySignal++
      } else {
        const v = inv * (1 + (r.p as number) / 100)
        openProfit += v - inv
        openValue += v
        openCount++
        sellRets.push(r.p as number)
      }
    }
    // Sale proceeds land before same-day buys. The smallest running balance is the cash needed to fund everything.
    events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : b.amount - a.amount))
    let balance = 0
    let minBalance = 0
    for (const e of events) {
      balance += e.amount
      if (balance < minBalance) minBalance = balance
    }
    const minCapital = Math.max(0, -minBalance)
    const endingValue = minCapital + balance + openValue
    sell = {
      closedCount,
      openCount,
      closedProfit,
      openProfit,
      avgHoldDays: holdDays.length ? holdDays.reduce((a, b) => a + b, 0) / holdDays.length : null,
      minCapital,
      endingValue,
      returnOnCapital: minCapital > 0 ? ((endingValue - minCapital) / minCapital) * 100 : null,
      winRate: sellRets.length ? (sellRets.filter(x => x >= 0).length / sellRets.length) * 100 : null,
      byAtr,
      bySignal,
    }
  }

  return {
    count: rows.length,
    pending,
    hold,
    spy: {
      value: spyValue,
      returnPct: spyReturnPct,
      deltaPct: heldOnSpyRows !== null && spyReturnPct !== null ? heldOnSpyRows - spyReturnPct : null,
      n: spyInvested > 0 ? known.filter(r => spy(r.d) !== null).length : 0,
    },
    sell,
    avgMult: known.length ? multSum / known.length : null,
  }
}

// ─── Cohorts: return of the signals issued in each period ───────────────────────────────────

export interface Cohort {
  key: string
  label: string
  signals: number
  invested: number
  returnPct: number | null
}

function periodKey(date: string, freq: Freq): string {
  if (freq === 'daily') return date
  if (freq === 'weekly') return isoWeekKey(date)
  return date.slice(0, 7)
}

function periodLabel(firstDate: string, freq: Freq): string {
  const d = new Date(firstDate + 'T12:00:00Z')
  return freq === 'monthly'
    ? d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** The last `limit` periods that have signals, oldest first, using the strategy's returns. */
export function cohorts(rows: SigRow[], base: number, strat: Strategy, freq: Freq, limit = 12): Cohort[] {
  const groups = new Map<string, { first: string; n: number; inv: number; val: number }>()
  for (const r of rows) {
    if (r.p === null) continue
    const eff = effective(r, strat)
    const ret = eff.closed && eff.retPct !== null ? eff.retPct : r.p
    const inv = base * r.m
    const k = periodKey(r.d, freq)
    const g = groups.get(k) ?? { first: r.d, n: 0, inv: 0, val: 0 }
    if (r.d < g.first) g.first = r.d
    g.n++
    g.inv += inv
    g.val += inv * (1 + ret / 100)
    groups.set(k, g)
  }
  return Array.from(groups.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-limit)
    .map(([key, g]) => ({
      key,
      label: periodLabel(g.first, freq),
      signals: g.n,
      invested: g.inv,
      returnPct: g.inv > 0 ? (g.val / g.inv - 1) * 100 : null,
    }))
}
