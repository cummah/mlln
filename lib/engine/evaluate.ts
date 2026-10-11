// Enhanced DCA signal evaluation on a single bar. Pure and stateless.

import { MIN_BARS, WINDOW_BARS, type Bar, type EngineConfig, type Freq } from './config'
import { adxAt, drawdownAt, emaAt, rsiAt } from './indicators'

export interface Components {
  date: string
  rsi: number
  rsiMult: number
  emaDistPct: number
  emaMult: number
  adx: number
  plusDI: number
  minusDI: number
  regimeAdj: number
  drawdownPct: number
  ddBonus: number
  vix: number | null
  vixBonus: number
  finalMult: number
  isCapped: boolean
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

/** Start index of the trailing window for a bar. Always the same for the same bar. */
export function windowStart(idx: number): number {
  return Math.max(0, idx - WINDOW_BARS + 1)
}

/** ISO week key, Monday based, so a calendar week never straddles two keys at year end. */
export function isoWeekKey(date: string): string {
  const d = new Date(date + 'T12:00:00Z')
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day) // Thursday of this ISO week
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function periodKey(date: string, freq: Freq): string {
  if (freq === 'daily') return date
  if (freq === 'weekly') return isoWeekKey(date)
  return date.slice(0, 7)
}

/** True when this bar is the first bar of its period, which is when a signal is evaluated. */
export function isEvaluationBar(bars: Bar[], idx: number, freq: Freq): boolean {
  if (freq === 'daily') return true
  if (idx === 0) return true
  return periodKey(bars[idx].date, freq) !== periodKey(bars[idx - 1].date, freq)
}

/**
 * Evaluate the Enhanced model on bar idx. Uses only bars up to and including idx, and at most
 * WINDOW_BARS of them. Returns null while there is not enough history.
 */
export function evaluateAt(bars: Bar[], idx: number, cfg: EngineConfig): Components | null {
  if (idx < MIN_BARS - 1) return null
  const s = windowStart(idx)
  const bar = bars[idx]

  const rsi = rsiAt(bars, s, idx, cfg.rsiLength)
  const ema = emaAt(bars, s, idx, cfg.emaLength)
  const dir = adxAt(bars, s, idx, cfg.adxPeriod)
  if (rsi === null || ema === null || dir === null || !(ema > 0)) return null

  let rsiMult = cfg.buyPercent5 / 100
  if (rsi <= cfg.rsiLevel1) rsiMult = cfg.buyPercent1 / 100
  else if (rsi <= cfg.rsiLevel2) rsiMult = cfg.buyPercent2 / 100
  else if (rsi <= cfg.rsiLevel3) rsiMult = cfg.buyPercent3 / 100
  else if (rsi <= cfg.rsiLevel4) rsiMult = cfg.buyPercent4 / 100

  const emaDistPct = ((bar.close - ema) / ema) * 100
  const emaNorm = clamp(emaDistPct / cfg.emaMaxPct, -1, 1)
  const emaMult =
    emaNorm < 0
      ? 1 + Math.abs(emaNorm) * (cfg.emaBelowMaxMult - 1)
      : 1 - emaNorm * (1 - cfg.emaAboveMinMult)

  const dd = drawdownAt(bars, s, idx, cfg.drawdownLookback)
  const trendingDown = dir.adx > cfg.adxThreshold && dir.minusDI > dir.plusDI
  const extremeDD = dd * 100 >= cfg.extremeDrawdownThreshold
  const regimeAdj = trendingDown && !extremeDD ? cfg.trendPenalty : 1
  const ddBonus = Math.min(1 + dd * cfg.drawdownAggression, cfg.maxDrawdownBonus)

  const vix = bar.vix ?? null
  const vixBonus = vix !== null && vix > cfg.vixThreshold && rsi <= cfg.rsiLevel3 ? cfg.vixBonusMultiplier : 1

  const raw = rsiMult * regimeAdj * ddBonus * vixBonus * emaMult
  return {
    date: bar.date,
    rsi,
    rsiMult,
    emaDistPct,
    emaMult,
    adx: dir.adx,
    plusDI: dir.plusDI,
    minusDI: dir.minusDI,
    regimeAdj,
    drawdownPct: dd * 100,
    ddBonus,
    vix,
    vixBonus,
    finalMult: Math.min(raw, cfg.maxTotalMultiplier),
    isCapped: raw > cfg.maxTotalMultiplier,
  }
}

/**
 * Attach VIX to bars by date. A missing VIX day is filled from the last known value within
 * `maxCarryDays`; beyond that it stays null and is counted, so the caller can fail loudly
 * instead of silently dropping the VIX bonus.
 */
export function attachVix(
  bars: Bar[],
  vixByDate: Map<string, number>,
  maxCarryDays = 5
): { missing: number } {
  let missing = 0
  let last: number | null = null
  let lastTs = 0
  for (const b of bars) {
    const v = vixByDate.get(b.date)
    const ts = new Date(b.date + 'T12:00:00Z').getTime()
    if (v !== undefined) {
      last = v
      lastTs = ts
      b.vix = v
    } else if (last !== null && (ts - lastTs) / 86400000 <= maxCarryDays) {
      b.vix = last
    } else {
      b.vix = null
      missing++
    }
  }
  return { missing }
}
