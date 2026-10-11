// Price-only indicators stored on every signal. No macro, FRED, fundamentals or score tables.
// Each is computed from the trailing window ending on the signal date, nothing later.

import { ATR_PERIOD, type Bar } from './config'
import { atrAt } from './indicators'
import { windowStart } from './evaluate'

// ─── Volatility timing ──────────────────────────────────────────────────────────────────────
const EWMA_LAMBDA = 0.94
const VOL_MEDIAN_WINDOW = 252
const VOL_RATIO_MIN = 0.3
const VOL_RATIO_MAX = 3
const VOL_AGGRESSION = 0.6
const VOL_CLAMP = 0.3

/**
 * Bonus on down days only: positive when volatility is calm against its own one year median,
 * negative when elevated. The variance seed is the first 20 returns of the window, and the
 * window is fixed, so the same date always gives the same value.
 */
export function volTimingAt(bars: Bar[], idx: number): number | null {
  const s = windowStart(idx)
  const n = idx - s + 1
  if (n < VOL_MEDIAN_WINDOW + 20) return null

  const r = new Float64Array(n - 1)
  for (let i = 1; i < n; i++) r[i - 1] = bars[s + i].close / bars[s + i - 1].close - 1

  const seedN = Math.min(20, r.length)
  let seedMean = 0
  for (let i = 0; i < seedN; i++) seedMean += r[i]
  seedMean /= seedN
  let variance = 0
  for (let i = 0; i < seedN; i++) variance += (r[i] - seedMean) ** 2
  variance /= seedN

  const vol = new Float64Array(r.length)
  for (let i = 0; i < r.length; i++) {
    if (i > 0) variance = EWMA_LAMBDA * variance + (1 - EWMA_LAMBDA) * r[i - 1] * r[i - 1]
    vol[i] = Math.sqrt(variance)
  }

  const last = r.length - 1
  if (!(r[last] < 0)) return 0 // up or flat day: no dip to buy
  const from = Math.max(0, last - VOL_MEDIAN_WINDOW + 1)
  const sorted = Array.from(vol.subarray(from, last + 1)).sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const ratio = median > 0 ? vol[last] / median : 1
  const clamped = Math.max(VOL_RATIO_MIN, Math.min(VOL_RATIO_MAX, ratio))
  return Math.max(-VOL_CLAMP, Math.min(VOL_CLAMP, VOL_AGGRESSION * (1 / clamped - 1)))
}

// ─── Mean reversion ─────────────────────────────────────────────────────────────────────────
const MR_TREND_WINDOW = 150
const MR_HALFLIFE_REFERENCE = 20
const MR_CONFIDENCE_CAP = 2
const MR_CLAMP = 0.3
const MR_AGGRESSION = 0.27
const MR_MIN_BARS = MR_TREND_WINDOW + 30

export interface MeanReversion {
  bonus: number
  halfLifeDays: number | null
  zScore: number
}

/**
 * Distance of log price from its 150 bar average, in standard deviations, weighted by how fast
 * this stock has reverted. Speed (AR1 fit) and spread (std) come only from the trailing window,
 * so a 2022 value never sees 2026 behaviour. Null while history is too short.
 */
export function meanReversionAt(bars: Bar[], idx: number): MeanReversion | null {
  const s = windowStart(idx)
  const n = idx - s + 1
  if (n < MR_MIN_BARS) return null

  const dev = new Float64Array(n - MR_TREND_WINDOW + 1)
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += Math.log(bars[s + i].close)
    if (i >= MR_TREND_WINDOW) sum -= Math.log(bars[s + i - MR_TREND_WINDOW].close)
    if (i >= MR_TREND_WINDOW - 1) dev[i - (MR_TREND_WINDOW - 1)] = Math.log(bars[s + i].close) - sum / MR_TREND_WINDOW
  }
  const m = dev.length
  if (m < 30) return null

  let sx = 0, sy = 0, sxy = 0, sxx = 0
  for (let i = 1; i < m; i++) {
    const x = dev[i - 1], y = dev[i]
    sx += x; sy += y; sxy += x * y; sxx += x * x
  }
  const cnt = m - 1
  const denom = cnt * sxx - sx * sx
  const b = denom !== 0 ? (cnt * sxy - sx * sy) / denom : 1
  const halfLife = b > 0 && b < 1 ? Math.log(2) / -Math.log(b) : null

  let mean = 0
  for (let i = 0; i < m; i++) mean += dev[i]
  mean /= m
  let v = 0
  for (let i = 0; i < m; i++) v += (dev[i] - mean) ** 2
  const std = Math.sqrt(v / m)
  if (!(std > 0)) return null

  const z = dev[m - 1] / std
  if (halfLife === null) return { bonus: 0, halfLifeDays: null, zScore: z }
  const confidence = Math.max(0, Math.min(MR_CONFIDENCE_CAP, MR_HALFLIFE_REFERENCE / halfLife))
  const bonus = Math.max(-MR_CLAMP, Math.min(MR_CLAMP, MR_AGGRESSION * -z * confidence))
  return { bonus, halfLifeDays: halfLife, zScore: z }
}

// ─── Technicals ─────────────────────────────────────────────────────────────────────────────
export interface Technicals {
  atrPct: number | null
  trendStrength: number | null
  momentum5d: number | null
}

export function technicalsAt(bars: Bar[], idx: number): Technicals {
  const s = windowStart(idx)
  const atr = atrAt(bars, s, idx, ATR_PERIOD)
  const close = bars[idx].close
  const atrPct = atr !== null && close > 0 ? (atr / close) * 100 : null

  let trendStrength: number | null = null
  if (idx - s >= ATR_PERIOD - 1) {
    let lo = Infinity
    let hi = -Infinity
    for (let i = idx - ATR_PERIOD + 1; i <= idx; i++) {
      const c = bars[i].close
      if (c < lo) lo = c
      if (c > hi) hi = c
    }
    const range = hi - lo
    trendStrength = range > 0 ? Math.abs(close - bars[idx - ATR_PERIOD + 1].close) / range : 0
  }

  const base = idx - s >= 5 ? bars[idx - 5].close : null
  const momentum5d = base !== null && base > 0 ? ((close - base) / base) * 100 : null
  return { atrPct, trendStrength, momentum5d }
}

// ─── Factor regime ──────────────────────────────────────────────────────────────────────────
const PCA_SCALE = 2.75
const FACTOR_CLAMP = 0.4

/** Stock's exposure to the factors, weighted by recent factor momentum. Both inputs are walk-forward. */
export function factorRegime(loadings: number[] | null | undefined, momentumZ: number[] | null | undefined): number | null {
  if (!loadings || !momentumZ || loadings.length === 0 || momentumZ.length === 0) return null
  let dot = 0
  for (let i = 0; i < loadings.length; i++) dot += loadings[i] * (momentumZ[i] ?? 0)
  return Math.max(-FACTOR_CLAMP, Math.min(FACTOR_CLAMP, PCA_SCALE * dot))
}
