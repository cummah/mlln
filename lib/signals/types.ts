// Shared shapes for the signal pages. Plain data only, so it is safe in server and client code.

export type Freq = 'daily' | 'weekly' | 'monthly'

export interface TickerInfo {
  ticker: string
  name: string
  sector: string
  dca: number | null // DCA suitability score
  alpha: number | null // 5 year alpha of this ticker's strategy vs standard DCA
}

/** One signal, in the compact form sent to the browser. Returns are percentages, scores are fractions. */
export interface SigRow {
  i: number // index into tickers
  d: string // signal date
  m: number // multiplier
  p: number | null // return to the latest close if simply held. Null until the entry price exists.
  xd: string | null // date of the exit signal that closes it, null while open
  xr: number | null // return if sold at that exit day's close
  xn: number | null // return if sold at the next open. Null until that open exists.
  xs: number | null // exit score on that date
  f: number | null // factor regime
  v: number | null // volatility timing
  r: number | null // mean reversion
  a: number | null // volatility, ATR(14) as a percent of price
  wa: number | null // days since a weekly buy (daily page only)
  ma: number | null // days since a monthly buy (daily page only)
  sd: (string | null)[] | null // ATR stop dates (daily page only)
  sr: (number | null)[] | null // ATR stop returns (daily page only)
}

export interface FeedPayload {
  freq: Freq
  tickers: TickerInfo[]
  rows: SigRow[]
  asOf: string | null // date of the newest stored close
  latestDate: string | null // latest signal date (for gating UI)
  pricesRunAt: string | null
  signalsRunAt: string | null
  signalsStatus: string | null // ok, partial or failed
  spyDates: string[]
  spyCloses: number[]
  windowFrom: string // earliest signal date requested
  minMult: number // server side floor on the multiplier
  truncated: boolean // true if the row cap was hit, so the page can say so
}

/** The rules for the "sell on exit signal" side. Buy and hold has no rules and is always shown beside it. */
export interface Strategy {
  minExit: number // exit score range
  maxExit: number
  nextOpen: boolean // sell at the next open instead of the exit day's close
  atrIdx: number | null // index into ATR_MULTIPLIERS, daily page only
  fee: number // dollars per closed trade
  sellIfNegativeDays: number | null // sell if negative after X days
  sellIfDownPct: number | null // sell if down X percent
  base?: number // base amount for saving/restoring preferences
}

export interface Effective {
  closed: boolean
  date: string | null
  retPct: number | null // null when the return cannot be known yet
  reason: 'signal' | 'atr' | null
}

export interface Filters {
  search: string
  sectors: string[]
  dateFrom: string | null
  year: number | null
  mult: [number, number]
  dca: [number, number]
  factor: [number, number] // percent
  vol: [number, number] // percent
  mr: [number, number] // percent
  atr: [number, number] // percent
  status: 'all' | 'open' | 'closed'
  returns: 'all' | 'positive' | 'negative'
  weeklyAligned: boolean
  monthlyAligned: boolean
}
