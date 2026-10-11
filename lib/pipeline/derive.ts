// Turns price bars into database rows. Pure and deterministic: the one-time backfill and the
// nightly job both call this, so they cannot disagree about what a signal is.

import { ENGINE_VERSION, FREQ_CONFIG, type Bar, type Freq } from '../engine/config'
import { evaluateAt, isEvaluationBar } from '../engine/evaluate'
import { atrStops, shouldExit } from '../engine/exits'
import { meanReversionAt, technicalsAt, volTimingAt } from '../engine/priceIndicators'

/** Daily signals are only shown for about 12 weeks, so older ones are not kept. */
export const DAILY_RETENTION_DAYS = 120

export interface SignalRowDb {
  ticker: string
  freq: Freq
  signal_date: string
  mult: number
  entry_date: string | null
  entry_price: number | null
  rsi: number
  rsi_mult: number
  ema_dist_pct: number
  ema_mult: number
  regime_adj: number
  drawdown_pct: number
  dd_bonus: number
  vix: number | null
  vix_bonus: number
  factor_regime: number | null
  vol_timing: number | null
  mean_reversion: number | null
  mr_half_life: number | null
  atr_pct: number | null
  trend_strength: number | null
  momentum_5d: number | null
  weekly_align_days: number | null
  monthly_align_days: number | null
  atr_breach_dates: (string | null)[] | null
  atr_breach_prices: (number | null)[] | null
  engine_version: number
}

export interface ExitEventDb {
  ticker: string
  freq: Freq
  event_date: string
  score: number
  close: number
  next_open_date: string | null
  next_open: number | null
}

export interface DeriveResult {
  signals: SignalRowDb[]
  events: ExitEventDb[]
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00Z').getTime() - new Date(a + 'T12:00:00Z').getTime()) / 86400000)
}

/** Days since the most recent buy at `other` frequency within the window, or null. Point-in-time. */
function alignmentDays(bars: Bar[], idx: number, other: 'weekly' | 'monthly', windowDays: number): number | null {
  const cfg = FREQ_CONFIG[other]
  const date = bars[idx].date
  for (let j = idx; j >= 0; j--) {
    const age = daysBetween(bars[j].date, date)
    if (age > windowDays) return null
    if (!isEvaluationBar(bars, j, other)) continue
    const c = evaluateAt(bars, j, cfg)
    if (c && c.finalMult > 0) return age
  }
  return null
}

/**
 * Derive signal rows and exit events for bar indices from..to inclusive (clamped to the data).
 * `factorAt` supplies the walk-forward factor regime value for a bar, or null when unknown.
 * Rows depend on later bars only for the fill price and ATR stops, never for any indicator.
 */
export function derive(
  ticker: string,
  bars: Bar[],
  freq: Freq,
  from: number,
  to: number,
  factorAt: (idx: number) => number | null
): DeriveResult {
  const cfg = FREQ_CONFIG[freq]
  const slip = cfg.slippagePct / 100
  const signals: SignalRowDb[] = []
  const events: ExitEventDb[] = []
  const last = Math.min(to, bars.length - 1)

  for (let idx = Math.max(0, from); idx <= last; idx++) {
    if (!isEvaluationBar(bars, idx, freq)) continue
    const c = evaluateAt(bars, idx, cfg)
    if (!c) continue

    const next = idx + 1 < bars.length ? bars[idx + 1] : null

    const ex = shouldExit(c, cfg)
    if (ex.exit) {
      events.push({
        ticker,
        freq,
        event_date: c.date,
        score: ex.score,
        close: bars[idx].close,
        next_open_date: next ? next.date : null,
        next_open: next ? next.open * (1 - slip) : null,
      })
    }

    if (c.finalMult <= 0) continue

    const mr = meanReversionAt(bars, idx)
    const tech = technicalsAt(bars, idx)
    const stops = freq === 'daily' ? atrStops(bars, idx) : null

    signals.push({
      ticker,
      freq,
      signal_date: c.date,
      mult: c.finalMult,
      entry_date: next ? next.date : null,
      entry_price: next ? next.open * (1 + slip) : null,
      rsi: c.rsi,
      rsi_mult: c.rsiMult,
      ema_dist_pct: c.emaDistPct,
      ema_mult: c.emaMult,
      regime_adj: c.regimeAdj,
      drawdown_pct: c.drawdownPct,
      dd_bonus: c.ddBonus,
      vix: c.vix,
      vix_bonus: c.vixBonus,
      factor_regime: factorAt(idx),
      vol_timing: volTimingAt(bars, idx),
      mean_reversion: mr ? mr.bonus : null,
      mr_half_life: mr ? mr.halfLifeDays : null,
      atr_pct: tech.atrPct,
      trend_strength: tech.trendStrength,
      momentum_5d: tech.momentum5d,
      weekly_align_days: freq === 'daily' ? alignmentDays(bars, idx, 'weekly', 28) : null,
      monthly_align_days: freq === 'daily' ? alignmentDays(bars, idx, 'monthly', 90) : null,
      atr_breach_dates: stops ? stops.dates : null,
      atr_breach_prices: stops ? stops.prices : null,
      engine_version: ENGINE_VERSION,
    })
  }
  return { signals, events }
}

/** First bar index to derive for a frequency, honouring daily retention. */
export function startIndexFor(bars: Bar[], freq: Freq, asOf: string): number {
  if (freq !== 'daily') return 0
  const cutoff = new Date(new Date(asOf + 'T12:00:00Z').getTime() - DAILY_RETENTION_DAYS * 86400000).toISOString().slice(0, 10)
  const i = bars.findIndex(b => b.date >= cutoff)
  return i < 0 ? bars.length : i
}

/** The fields that may legitimately change after a signal is created. Everything else is frozen. */
export function mutablePatch(row: SignalRowDb) {
  return {
    ticker: row.ticker,
    freq: row.freq,
    signal_date: row.signal_date,
    mult: row.mult, // required by the table, unchanged
    entry_date: row.entry_date,
    entry_price: row.entry_price,
    atr_breach_dates: row.atr_breach_dates,
    atr_breach_prices: row.atr_breach_prices,
  }
}

export function mutableKey(row: SignalRowDb): string {
  return JSON.stringify([row.entry_date, row.entry_price, row.atr_breach_dates, row.atr_breach_prices])
}
