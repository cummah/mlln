// Walk-forward statistical factor model. Pure: no database access.
//
// Same method as before (PCA on standardised daily returns across the universe, 5 factors,
// factor momentum = rolling 63 day sum of factor scores z-scored against the last 252 days),
// with one change that matters: every fit uses ONLY returns before the fit date. A fit is made on
// the first trading day of each month and used for that month. A 2022 signal therefore sees the
// factor structure as it was known in 2022, not the structure of the full five years.

import { PCA } from 'ml-pca'

export const NUM_FACTORS = 5
export const FIT_RETURNS = 504 // two years of daily returns
export const MOMENTUM_LOOKBACK = 63
export const ZSCORE_LOOKBACK = 252
export const MIN_COVERAGE = 0.95
const MIN_UNIVERSE = 100
const MOMENTUM_WARMUP = MOMENTUM_LOOKBACK - 1 + ZSCORE_LOOKBACK - 1 // first index with a z-score

const PCA_SCALE = 2.75
const REGIME_CLAMP = 0.4

export interface FactorFit {
  fitDate: string
  loadings: Map<string, number[]> // ticker -> exposure to each factor
  mean: Map<string, number> // mean daily return in the fit window
  std: Map<string, number> // std of daily return in the fit window
  K: number
}

/** Closes aligned to a shared trading calendar. NaN where a ticker has no bar that day. */
export type CloseMatrix = Map<string, Float64Array>

/**
 * Fit on the FIT_RETURNS returns ending the day before calendar index F.
 * Uses closes at indices F-FIT_RETURNS-1 .. F-1 only. Returns null if the universe is too small.
 */
export function fitFactors(calendar: string[], closes: CloseMatrix, F: number): FactorFit | null {
  const start = F - FIT_RETURNS - 1
  if (start < 0 || F >= calendar.length + 1) return null

  const tickers: string[] = []
  const cols: Float64Array[] = []
  for (const [ticker, c] of Array.from(closes.entries())) {
    let valid = 0
    for (let i = start; i <= F - 1; i++) if (!Number.isNaN(c[i])) valid++
    if (valid / (FIT_RETURNS + 1) < MIN_COVERAGE) continue

    const filled = new Float64Array(FIT_RETURNS + 1)
    let last = NaN
    for (let k = 0; k <= FIT_RETURNS; k++) {
      const v = c[start + k]
      if (!Number.isNaN(v)) last = v
      filled[k] = last
    }
    const first = filled.find(v => !Number.isNaN(v))
    if (first === undefined) continue
    for (let k = 0; k <= FIT_RETURNS && Number.isNaN(filled[k]); k++) filled[k] = first

    const r = new Float64Array(FIT_RETURNS)
    for (let k = 0; k < FIT_RETURNS; k++) r[k] = filled[k + 1] / filled[k] - 1
    tickers.push(ticker)
    cols.push(r)
  }

  // Standardise each ticker, dropping any with no variance
  const keepTickers: string[] = []
  const mean = new Map<string, number>()
  const std = new Map<string, number>()
  const keepCols: Float64Array[] = []
  for (let j = 0; j < tickers.length; j++) {
    const r = cols[j]
    let m = 0
    for (let k = 0; k < FIT_RETURNS; k++) m += r[k]
    m /= FIT_RETURNS
    let v = 0
    for (let k = 0; k < FIT_RETURNS; k++) v += (r[k] - m) ** 2
    const s = Math.sqrt(v / FIT_RETURNS)
    if (!(s > 0) || !Number.isFinite(s)) continue
    keepTickers.push(tickers[j])
    mean.set(tickers[j], m)
    std.set(tickers[j], s)
    keepCols.push(r)
  }
  if (keepTickers.length < MIN_UNIVERSE) return null

  const Z: number[][] = []
  for (let k = 0; k < FIT_RETURNS; k++) {
    const row = new Array<number>(keepTickers.length)
    for (let j = 0; j < keepTickers.length; j++) {
      const t = keepTickers[j]
      row[j] = (keepCols[j][k] - mean.get(t)!) / std.get(t)!
    }
    Z.push(row)
  }

  const pca = new PCA(Z, { center: false, scale: false, method: 'SVD' })
  const K = Math.min(NUM_FACTORS, keepTickers.length - 1, FIT_RETURNS - 1)
  const L = pca.getLoadings().to2DArray().slice(0, K) // K x N

  // Fix each component's sign so the fit is reproducible: loadings sum to a positive number
  for (const row of L) {
    let sum = 0
    for (const v of row) sum += v
    if (sum < 0) for (let j = 0; j < row.length; j++) row[j] = -row[j]
  }

  const loadings = new Map<string, number[]>()
  keepTickers.forEach((t, j) => loadings.set(t, L.map(row => row[j])))
  return { fitDate: calendar[F] ?? calendar[calendar.length - 1], loadings, mean, std, K }
}

/** One day's factor scores from a map of that day's returns. Tickers without a return add nothing. */
export function dayScore(fit: FactorFit, returns: Map<string, number> | ((t: string) => number | undefined)): number[] {
  const get = typeof returns === 'function' ? returns : (t: string) => returns.get(t)
  const s = new Array<number>(fit.K).fill(0)
  fit.loadings.forEach((load, ticker) => {
    const r = get(ticker)
    if (r === undefined || !Number.isFinite(r)) return
    const z = (r - fit.mean.get(ticker)!) / fit.std.get(ticker)!
    for (let k = 0; k < fit.K; k++) s[k] += load[k] * z
  })
  return s
}

/**
 * Momentum z-score of the factor score series at the last index, or null while warming up.
 * Rolling 63 day sum, standardised against the previous 252 rolling sums.
 */
export function momentumZ(scores: number[][], K: number): number[] | null {
  const n = scores.length
  if (n - 1 < MOMENTUM_WARMUP) return null
  const out = new Array<number>(K)
  for (let k = 0; k < K; k++) {
    const rs = new Float64Array(ZSCORE_LOOKBACK)
    for (let w = 0; w < ZSCORE_LOOKBACK; w++) {
      const end = n - ZSCORE_LOOKBACK + w
      let sum = 0
      for (let j = end - MOMENTUM_LOOKBACK + 1; j <= end; j++) sum += scores[j][k]
      rs[w] = sum
    }
    let m = 0
    for (let w = 0; w < ZSCORE_LOOKBACK; w++) m += rs[w]
    m /= ZSCORE_LOOKBACK
    let v = 0
    for (let w = 0; w < ZSCORE_LOOKBACK; w++) v += (rs[w] - m) ** 2
    const sd = Math.sqrt(v / ZSCORE_LOOKBACK)
    out[k] = sd > 0 ? (rs[ZSCORE_LOOKBACK - 1] - m) / sd : 0
  }
  return out
}

/** Stock's exposure to the factors weighted by recent factor momentum, clamped. Null if unknown. */
export function regimeScore(loadings: number[] | undefined, z: number[] | null | undefined): number | null {
  if (!loadings || !z) return null
  let dot = 0
  for (let k = 0; k < loadings.length; k++) dot += loadings[k] * (z[k] ?? 0)
  return Math.max(-REGIME_CLAMP, Math.min(REGIME_CLAMP, PCA_SCALE * dot))
}

// ─── Walk-forward over a whole history (backfill and tests) ─────────────────────────────────

export interface WalkForward {
  fits: FactorFit[]
  fitOfDay: Int32Array // calendar index -> index into fits, or -1
  z: (number[] | null)[] // calendar index -> momentum z under that day's fit
  score: (number[] | null)[]
}

function monthOf(date: string): string {
  return date.slice(0, 7)
}

/** Raw one day return for a ticker at calendar index i, or undefined if either close is missing. */
function rawReturn(c: Float64Array, i: number): number | undefined {
  const a = c[i - 1]
  const b = c[i]
  return Number.isNaN(a) || Number.isNaN(b) || a <= 0 ? undefined : b / a - 1
}

/** Factor scores for calendar days from..to inclusive under a given fit. */
export function scoresUnderFit(fit: FactorFit, closes: CloseMatrix, from: number, to: number): number[][] {
  const out: number[][] = []
  for (let i = from; i <= to; i++) out.push(dayScore(fit, t => rawReturn(closes.get(t)!, i)))
  return out
}

/**
 * Refit on the first trading day of every month and apply each fit to the days of that month.
 * The factor score history needed for momentum is rebuilt under each new fit, using only days
 * before the day being scored. Days before the first possible fit have no value.
 */
export function walkForward(calendar: string[], closes: CloseMatrix, onFit?: (f: FactorFit, idx: number) => void): WalkForward {
  const n = calendar.length
  const fitOfDay = new Int32Array(n).fill(-1)
  const z: (number[] | null)[] = new Array(n).fill(null)
  const score: (number[] | null)[] = new Array(n).fill(null)
  const fits: FactorFit[] = []

  const refits: number[] = []
  for (let i = 1; i < n; i++) {
    if (monthOf(calendar[i]) !== monthOf(calendar[i - 1]) && i >= FIT_RETURNS + 1) refits.push(i)
  }

  for (let r = 0; r < refits.length; r++) {
    const F = refits[r]
    const G = r + 1 < refits.length ? refits[r + 1] : n
    const fit = fitFactors(calendar, closes, F)
    if (!fit) continue
    fits.push(fit)
    onFit?.(fit, F)
    const fitIdx = fits.length - 1

    // Scores for every day of the fit window and the days this fit will be used for
    const first = F - FIT_RETURNS
    const series = scoresUnderFit(fit, closes, first, G - 1)
    for (let i = F; i < G; i++) {
      const upto = i - first + 1
      fitOfDay[i] = fitIdx
      score[i] = series[upto - 1]
      z[i] = momentumZ(series.slice(0, upto), fit.K)
    }
  }
  return { fits, fitOfDay, z, score }
}

/** Factor regime of a ticker on a calendar day under the walk-forward result, or null. */
export function regimeAt(wf: WalkForward, ticker: string, idx: number): number | null {
  const f = wf.fitOfDay[idx]
  if (f < 0) return null
  return regimeScore(wf.fits[f].loadings.get(ticker), wf.z[idx])
}

// ─── Rows for storage, shared by the backfill and the nightly refit ──────────────────────────

export interface FactorSeriesRow {
  date: string
  fit_date: string
  score: number[]
  z: number[] | null
}

/** factor_series rows for the fit window and every day after it up to the last calendar day. */
export function seriesRows(fit: FactorFit, calendar: string[], closes: CloseMatrix, F: number): FactorSeriesRow[] {
  const first = F - FIT_RETURNS
  const scores = scoresUnderFit(fit, closes, first, calendar.length - 1)
  return scores.map((s, k) => {
    const idx = first + k
    return { date: calendar[idx], fit_date: fit.fitDate, score: s, z: idx >= F ? momentumZ(scores.slice(0, k + 1), fit.K) : null }
  })
}

export function loadingRows(fit: FactorFit) {
  const rows: { ticker: string; fit_date: string; loadings: number[]; mean_ret: number; std_ret: number }[] = []
  fit.loadings.forEach((l, ticker) => rows.push({ ticker, fit_date: fit.fitDate, loadings: l, mean_ret: fit.mean.get(ticker)!, std_ret: fit.std.get(ticker)! }))
  return rows
}
