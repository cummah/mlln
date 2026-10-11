import { FREQ_CONFIG, type Bar, type Freq } from '../engine/config'
import { evaluateAt, isEvaluationBar } from '../engine/evaluate'
import { shouldExit } from '../engine/exits'

/** The engine's reading on the newest bar, including "no buy", for the live signal tile. */
export function currentRow(ticker: string, bars: Bar[], freq: Freq) {
  const idx = bars.length - 1
  const cfg = FREQ_CONFIG[freq]
  const c = evaluateAt(bars, idx, cfg)
  if (!c) return null
  return {
    ticker,
    freq,
    as_of: c.date,
    mult: c.finalMult,
    components: {
      rsi: c.rsi, rsiMult: c.rsiMult, emaDistPct: c.emaDistPct, emaMult: c.emaMult, adx: c.adx,
      regimeAdj: c.regimeAdj, drawdownPct: c.drawdownPct, ddBonus: c.ddBonus, vix: c.vix, vixBonus: c.vixBonus,
      isCapped: c.isCapped, isEvaluationBar: isEvaluationBar(bars, idx, freq), exitScore: shouldExit(c, cfg).score,
    },
    updated_at: new Date().toISOString(),
  }
}
