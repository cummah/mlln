/**
 * macroFactors.ts
 *
 * Shared functions for computing regime factor, volatility timing, and mean reversion
 * bonuses based on historical price data. Used by signal enrichment scripts to compute
 * these factors independently for each timeframe (daily, weekly, monthly).
 */

export interface PriceBar {
  date: string
  close: number
}

export interface VolPoint {
  volRatio: number
  isDip: boolean
}

export interface MeanReversionState {
  zScoreByDate: Map<string, number>
  halfLifeDays: number | null
}

// ─── Factor Model (PCA-based regime) ────────────────────────────────────────

const PCA_SCALE = 2.75
const MODIFIER_CLAMP = 0.4

function normalizeLoadings(loadings: any): number[] | undefined {
  if (!loadings) return undefined
  if (Array.isArray(loadings)) return loadings
  if (typeof loadings === 'object') {
    const arr: number[] = []
    for (let i = 1; i <= 10; i++) {
      const key = `f${i}`
      if (key in loadings) arr.push(loadings[key])
    }
    return arr.length > 0 ? arr : undefined
  }
  return undefined
}

function dot(a: number[] | undefined, b: number[]): number {
  if (!a || !Array.isArray(a) || a.length === 0) return 0
  return a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0)
}

export function getPCAModifier(loadings: any | undefined, momentumVector: number[]): number {
  const normalized = normalizeLoadings(loadings)
  if (!normalized || normalized.length === 0) return 0
  const rawScore = dot(normalized, momentumVector)
  return Math.max(-MODIFIER_CLAMP, Math.min(MODIFIER_CLAMP, PCA_SCALE * rawScore))
}

// ─── Volatility Timing ─────────────────────────────────────────────────────

const EWMA_LAMBDA = 0.94
const VOL_MEDIAN_WINDOW = 252
const VOL_RATIO_MIN = 0.3
const VOL_RATIO_MAX = 3
const VOL_AGGRESSION = 0.6
const VOL_BONUS_CLAMP = 0.3

export function computeEWMAVol(prices: PriceBar[]): Map<string, VolPoint> {
  const n = prices.length
  const returns: number[] = new Array(n - 1)
  for (let i = 1; i < n; i++) returns[i - 1] = prices[i].close / prices[i - 1].close - 1

  const seedN = Math.min(20, returns.length)
  const seedMean = returns.slice(0, seedN).reduce((a, b) => a + b, 0) / seedN
  let variance = returns.slice(0, seedN).reduce((a, b) => a + (b - seedMean) ** 2, 0) / seedN

  const volSeries: number[] = new Array(returns.length)
  for (let i = 0; i < returns.length; i++) {
    if (i > 0) variance = EWMA_LAMBDA * variance + (1 - EWMA_LAMBDA) * returns[i - 1] * returns[i - 1]
    volSeries[i] = Math.sqrt(variance)
  }

  const result = new Map<string, VolPoint>()
  for (let i = 0; i < returns.length; i++) {
    const windowStart = Math.max(0, i - VOL_MEDIAN_WINDOW + 1)
    const window = volSeries.slice(windowStart, i + 1).slice().sort((a, b) => a - b)
    const median = window[Math.floor(window.length / 2)]
    const volRatio = median > 0 ? volSeries[i] / median : 1
    result.set(prices[i + 1].date, { volRatio, isDip: returns[i] < 0 })
  }
  return result
}

export function getVolBonus(point: VolPoint | undefined): number {
  if (!point || !point.isDip) return 0
  const ratio = Math.max(VOL_RATIO_MIN, Math.min(VOL_RATIO_MAX, point.volRatio))
  const raw = VOL_AGGRESSION * (1 / ratio - 1)
  return Math.max(-VOL_BONUS_CLAMP, Math.min(VOL_BONUS_CLAMP, raw))
}

// ─── Mean Reversion ────────────────────────────────────────────────────────

const MR_TREND_WINDOW = 150
const MR_HALFLIFE_REFERENCE = 20
const MR_CONFIDENCE_CAP = 2
const MR_BONUS_CLAMP = 0.3
const MR_AGGRESSION = 0.27

export function computeMeanReversion(prices: PriceBar[]): MeanReversionState {
  const n = prices.length
  const zScoreByDate = new Map<string, number>()
  if (n < MR_TREND_WINDOW + 30) return { zScoreByDate, halfLifeDays: null }

  const logPrice = prices.map(p => Math.log(p.close))

  const deviation: number[] = new Array(n).fill(NaN)
  let windowSum = 0
  for (let i = 0; i < n; i++) {
    windowSum += logPrice[i]
    if (i >= MR_TREND_WINDOW) windowSum -= logPrice[i - MR_TREND_WINDOW]
    if (i >= MR_TREND_WINDOW - 1) deviation[i] = logPrice[i] - windowSum / MR_TREND_WINDOW
  }

  const validDeviation = deviation.filter(d => !isNaN(d))
  if (validDeviation.length < 30) return { zScoreByDate, halfLifeDays: null }

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, cnt = 0
  for (let i = 1; i < validDeviation.length; i++) {
    const x = validDeviation[i - 1], y = validDeviation[i]
    sumX += x; sumY += y; sumXY += x * y; sumXX += x * x; cnt++
  }
  const denom = cnt * sumXX - sumX * sumX
  const b = denom !== 0 ? (cnt * sumXY - sumX * sumY) / denom : 1
  const halfLifeDays = b > 0 && b < 1 ? Math.log(2) / -Math.log(b) : null

  const mean = validDeviation.reduce((a, v) => a + v, 0) / validDeviation.length
  const variance = validDeviation.reduce((a, v) => a + (v - mean) ** 2, 0) / validDeviation.length
  const std = Math.sqrt(variance)

  if (std > 0) {
    for (let i = 0; i < n; i++) {
      if (!isNaN(deviation[i])) zScoreByDate.set(prices[i].date, deviation[i] / std)
    }
  }

  return { zScoreByDate, halfLifeDays }
}

export function getMeanReversionBonus(zScore: number | undefined, halfLifeDays: number | null): number {
  if (zScore === undefined || halfLifeDays === null) return 0
  const confidence = Math.max(0, Math.min(MR_CONFIDENCE_CAP, MR_HALFLIFE_REFERENCE / halfLifeDays))
  const raw = MR_AGGRESSION * -zScore * confidence
  return Math.max(-MR_BONUS_CLAMP, Math.min(MR_BONUS_CLAMP, raw))
}
