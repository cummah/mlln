// Engine configuration. One place, no copies.
// Values are carried over unchanged from the previous pipeline so the Enhanced model behaves the same.

export type Freq = 'daily' | 'weekly' | 'monthly'

export interface Bar {
  date: string // YYYY-MM-DD
  open: number
  high: number
  low: number
  close: number
  vix?: number | null
}

export interface EngineConfig {
  slippagePct: number
  rsiLength: number
  rsiLevel1: number
  rsiLevel2: number
  rsiLevel3: number
  rsiLevel4: number
  buyPercent1: number
  buyPercent2: number
  buyPercent3: number
  buyPercent4: number
  buyPercent5: number
  adxPeriod: number
  adxThreshold: number
  trendPenalty: number
  drawdownAggression: number
  maxDrawdownBonus: number
  drawdownLookback: number
  extremeDrawdownThreshold: number
  emaLength: number
  emaMaxPct: number
  emaBelowMaxMult: number
  emaAboveMinMult: number
  vixThreshold: number
  vixBonusMultiplier: number
  maxTotalMultiplier: number
}

/**
 * Every indicator on a given date is computed from at most this many bars ending on that date.
 * This makes each value a pure function of its own trailing window, so it can never change when
 * later bars are appended or when the stored history is extended further back.
 */
export const WINDOW_BARS = 756

/** Minimum bars of history before the first signal is evaluated. */
export const MIN_BARS = 252

/** Bump when the maths changes, so stored rows can be told apart and rebuilt on purpose. */
export const ENGINE_VERSION = 2

const BASE: EngineConfig = {
  slippagePct: 0.05,
  rsiLength: 7,
  rsiLevel1: 35,
  rsiLevel2: 45,
  rsiLevel3: 50,
  rsiLevel4: 55,
  buyPercent1: 400,
  buyPercent2: 150,
  buyPercent3: 50,
  buyPercent4: 0,
  buyPercent5: 0,
  adxPeriod: 14,
  adxThreshold: 25,
  trendPenalty: 0.5,
  drawdownAggression: 2.0,
  maxDrawdownBonus: 2.0,
  drawdownLookback: 252,
  extremeDrawdownThreshold: 20,
  emaLength: 200,
  emaMaxPct: 15.0,
  emaBelowMaxMult: 2.0,
  emaAboveMinMult: 0.0,
  vixThreshold: 25,
  vixBonusMultiplier: 1.5,
  maxTotalMultiplier: 6.0,
}

export const FREQ_CONFIG: Record<Freq, EngineConfig> = {
  weekly: { ...BASE, rsiLength: 7 },
  monthly: { ...BASE, rsiLength: 14 },
  // Daily uses faster settings and looser RSI bands, as before.
  daily: { ...BASE, rsiLength: 5, rsiLevel3: 55, rsiLevel4: 65, emaLength: 14 },
}

/** A held position is sold on a later evaluation date whose exit score reaches this. */
export const EXIT_SCORE_THRESHOLD = 2.0

/** Trailing ATR(14) stop multipliers, one slot each. The UI slider indexes into this list. */
export const ATR_MULTIPLIERS = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0] as const
export const ATR_PERIOD = 14
