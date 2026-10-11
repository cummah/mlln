// Causal indicator kernels. Each function returns the value on bar `e`, using only bars s..e.
// They are single pass and allocation free, because the engine evaluates one window per signal date.

import type { Bar } from './config'

/** Wilder RSI on bar e, seeded from the first `len` changes after s. Null if too few bars. */
export function rsiAt(bars: Bar[], s: number, e: number, len: number): number | null {
  if (e - s < len) return null
  let sumGain = 0
  let sumLoss = 0
  for (let i = s + 1; i <= s + len; i++) {
    const d = bars[i].close - bars[i - 1].close
    if (d > 0) sumGain += d
    else sumLoss -= d
  }
  let avgGain = sumGain / len
  let avgLoss = sumLoss / len
  for (let i = s + len + 1; i <= e; i++) {
    const d = bars[i].close - bars[i - 1].close
    avgGain = (avgGain * (len - 1) + (d > 0 ? d : 0)) / len
    avgLoss = (avgLoss * (len - 1) + (d < 0 ? -d : 0)) / len
  }
  return avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
}

/** EMA on bar e, seeded with the simple average of the first `len` closes after s. */
export function emaAt(bars: Bar[], s: number, e: number, len: number): number | null {
  if (e - s + 1 < len) return null
  let sum = 0
  for (let i = s; i < s + len; i++) sum += bars[i].close
  let ema = sum / len
  const k = 2 / (len + 1)
  for (let i = s + len; i <= e; i++) ema = bars[i].close * k + ema * (1 - k)
  return ema
}

export interface AdxResult {
  adx: number
  plusDI: number
  minusDI: number
}

/** Wilder ADX and directional indicators on bar e. Null until 2*period-1 bars exist. */
export function adxAt(bars: Bar[], s: number, e: number, period: number): AdxResult | null {
  const m = e - s + 1
  if (m < 2 * period - 1) return null

  let smoothTR = 0
  let smoothPlus = 0
  let smoothMinus = 0
  let plusDI = 0
  let minusDI = 0
  let dxSum = 0
  let adx = 0

  for (let k = 0; k < m; k++) {
    const b = bars[s + k]
    let tr: number
    let plusDM = 0
    let minusDM = 0
    if (k === 0) {
      tr = b.high - b.low
    } else {
      const p = bars[s + k - 1]
      tr = Math.max(b.high - b.low, Math.abs(b.high - p.close), Math.abs(b.low - p.close))
      const up = b.high - p.high
      const down = p.low - b.low
      plusDM = up > 0 && up > down ? up : 0
      minusDM = down > 0 && down > up ? down : 0
    }

    if (k < period) {
      smoothTR += tr
      smoothPlus += plusDM
      smoothMinus += minusDM
    } else {
      smoothTR = smoothTR - smoothTR / period + tr
      smoothPlus = smoothPlus - smoothPlus / period + plusDM
      smoothMinus = smoothMinus - smoothMinus / period + minusDM
    }

    if (k >= period - 1) {
      plusDI = smoothTR > 0 ? (smoothPlus / smoothTR) * 100 : 0
      minusDI = smoothTR > 0 ? (smoothMinus / smoothTR) * 100 : 0
      const sum = plusDI + minusDI
      const dx = sum > 0 ? (Math.abs(plusDI - minusDI) / sum) * 100 : 0
      if (k <= 2 * period - 2) {
        dxSum += dx
        if (k === 2 * period - 2) adx = dxSum / period
      } else {
        adx = (adx * (period - 1) + dx) / period
      }
    }
  }
  return { adx, plusDI, minusDI }
}

/** Drawdown from the highest high of the last `lookback` bars, as a fraction. */
export function drawdownAt(bars: Bar[], s: number, e: number, lookback: number): number {
  let hi = -Infinity
  for (let i = Math.max(s, e - lookback + 1); i <= e; i++) if (bars[i].high > hi) hi = bars[i].high
  return hi > 0 ? (hi - bars[e].close) / hi : 0
}

/** Average of the last `period` true ranges on bar e. Null if there are not enough bars. */
export function atrAt(bars: Bar[], s: number, e: number, period: number): number | null {
  if (e - s < period) return null
  let sum = 0
  for (let i = e - period + 1; i <= e; i++) {
    const b = bars[i]
    const pc = bars[i - 1].close
    sum += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc))
  }
  return sum / period
}
