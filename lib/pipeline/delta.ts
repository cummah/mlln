// What changes in the database when new bars arrive. Pure, so it can be proven against a full
// recompute. Nothing is read back from the database: everything is derived from the bars, and
// compared with the same derivation one night earlier.

import type { Bar, Freq } from '../engine/config'
import {
  derive,
  mutableKey,
  mutablePatch,
  startIndexFor,
  type ExitEventDb,
  type SignalRowDb,
} from './derive'

/** Re-derive this many bars back so a fill price or stop that completed tonight is noticed. */
const LOOKBACK_BARS = 12

export interface TickerDelta {
  newSignals: SignalRowDb[]
  patches: ReturnType<typeof mutablePatch>[]
  newEvents: ExitEventDb[]
  eventPatches: ExitEventDb[]
}

/**
 * Delta for one ticker and frequency.
 * `watermark` is the date of the last bar already processed, or null for a brand new ticker.
 * `factorAt` is only consulted for signals that are new tonight; stored signals keep the value
 * they were created with, so a monthly refit can never rewrite history.
 */
export function nightlyDelta(
  ticker: string,
  bars: Bar[],
  freq: Freq,
  watermark: string | null,
  factorAt: (idx: number) => number | null
): TickerDelta {
  const n = bars.length
  const asOf = bars[n - 1].date

  if (watermark === null) {
    const from = startIndexFor(bars, freq, asOf)
    const full = derive(ticker, bars, freq, from, n - 1, factorAt)
    return { newSignals: full.signals, patches: [], newEvents: full.events, eventPatches: [] }
  }

  const w = bars.findIndex(b => b.date === watermark)
  if (w < 0) throw new Error(`${ticker} ${freq}: watermark ${watermark} is not a stored bar, needs a full rebuild`)
  if (w === n - 1) return { newSignals: [], patches: [], newEvents: [], eventPatches: [] }

  // Daily rows carry ATR stops that can trigger at any point while a signal is held, so the whole
  // retention window is re-derived. Weekly and monthly only need the recent bars for fill prices.
  const windowStart = startIndexFor(bars, freq, asOf)
  const from = freq === 'daily' ? windowStart : Math.max(windowStart, w - LOOKBACK_BARS)
  const before = derive(ticker, bars.slice(0, w + 1), freq, from, w, () => null)
  const now = derive(ticker, bars, freq, from, n - 1, factorAt)

  const beforeByDate = new Map(before.signals.map(s => [s.signal_date, s]))
  const newSignals: SignalRowDb[] = []
  const patches: TickerDelta['patches'] = []
  for (const s of now.signals) {
    if (s.signal_date > watermark) {
      newSignals.push(s)
    } else {
      const old = beforeByDate.get(s.signal_date)
      if (!old || mutableKey(old) !== mutableKey(s)) patches.push(mutablePatch(s))
    }
  }

  const beforeEventByDate = new Map(before.events.map(e => [e.event_date, e]))
  const newEvents: ExitEventDb[] = []
  const eventPatches: ExitEventDb[] = []
  for (const e of now.events) {
    if (e.event_date > watermark) newEvents.push(e)
    else {
      const old = beforeEventByDate.get(e.event_date)
      if (!old || old.next_open_date !== e.next_open_date) eventPatches.push(e)
    }
  }
  return { newSignals, patches, newEvents, eventPatches }
}
