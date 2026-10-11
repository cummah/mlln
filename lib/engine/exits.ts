// Exit rules. A held position is sold at the close of the first later evaluation date whose
// exit score reaches the threshold. The score depends only on that date, not on the position,
// so every open position of a ticker and frequency exits together.

import { ATR_MULTIPLIERS, ATR_PERIOD, EXIT_SCORE_THRESHOLD, type Bar, type EngineConfig } from './config'
import { atrAt } from './indicators'
import { windowStart, type Components } from './evaluate'

/** Product of five favourable-to-sell conditions. Same weights as the previous pipeline. */
export function exitScore(c: Components, cfg: EngineConfig): number {
  const rsiPart = c.rsi > cfg.rsiLevel4 ? 2.0 : c.rsi > cfg.rsiLevel3 ? 1.0 : 0.0
  const emaPart = c.emaMult < 0.8 ? 2.0 : c.emaMult <= 1.0 ? 1.0 : 0.0
  const regimePart = c.regimeAdj >= 1.0 ? 1.5 : 0.8
  const ddPart = c.ddBonus < 1.1 ? 1.5 : 1.0
  const vixPart = c.vixBonus <= 1.0 ? 1.3 : 0.8
  return rsiPart * emaPart * regimePart * ddPart * vixPart
}

export function shouldExit(c: Components, cfg: EngineConfig): { exit: boolean; score: number } {
  const score = exitScore(c, cfg)
  return { exit: score >= EXIT_SCORE_THRESHOLD, score: Math.round(score * 100) / 100 }
}

export interface AtrStops {
  dates: (string | null)[]
  prices: (number | null)[]
}

/**
 * Trailing ATR(14) stop for each multiplier k. Walking forward from the signal bar, the stop
 * level on day t is the highest close since the signal minus k times ATR(14) on day t. The
 * position is stopped out on the first day t whose close is at or below that level, at that close.
 * The level only ratchets up as the highest close rises, as the UI describes.
 */
export function atrStops(bars: Bar[], signalIdx: number): AtrStops {
  const dates: (string | null)[] = ATR_MULTIPLIERS.map(() => null)
  const prices: (number | null)[] = ATR_MULTIPLIERS.map(() => null)
  const open = ATR_MULTIPLIERS.map(() => true)
  let remaining = ATR_MULTIPLIERS.length

  let highest = bars[signalIdx].close
  for (let t = signalIdx + 1; t < bars.length && remaining > 0; t++) {
    const close = bars[t].close
    const atr = atrAt(bars, windowStart(t), t, ATR_PERIOD)
    if (close > highest) highest = close
    if (atr === null) continue
    for (let j = 0; j < ATR_MULTIPLIERS.length; j++) {
      if (open[j] && close <= highest - ATR_MULTIPLIERS[j] * atr) {
        open[j] = false
        dates[j] = bars[t].date
        prices[j] = close
        remaining--
      }
    }
  }
  return { dates, prices }
}
