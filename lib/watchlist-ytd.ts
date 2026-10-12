// Year to date results of the monthly plan on a watchlist, set against three benchmarks, all measured as return on the
// money put in:
//   mlln          the base amount times each month's signal multiplier, per asset (no signal that month, no buy)
//   std           standard DCA on the same assets: the flat base amount, every asset, every month
//   spyMirror     each mlln buy mirrored into SPY on the same day, for the same dollars
//   spyDca        standard DCA into SPY: the same total a flat plan on the list would put in, every month
// A buy fills at the entry price the signal feed holds for that signal. Where there is no signal (standard DCA, SPY) it
// fills at the open of the day after the month's first trading day, which is how the feed dates its own fills. Prices are
// price returns: no dividends, fees or slippage. Pure functions only, so the numbers are easy to check.

export type YtdKey = 'mlln' | 'std' | 'spyMirror' | 'spyDca'

export interface FeedEntry {
  mult: number
  entryDate: string | null
  entryPrice: number | null
}

export interface Bar {
  open: number | null
  close: number | null
}

export interface YtdSeries {
  key: YtdKey
  ret: (number | null)[] // percent return on money invested, per date, null before the first buy
}

export interface YtdTotals {
  invested: number
  value: number
}

export interface YtdAsset {
  ticker: string
  mlln: YtdTotals | null // null when the plan made no buy in this asset
  std: YtdTotals | null
  spyMirror: YtdTotals | null // SPY bought on the same days and for the same dollars as the mlln buys in this asset
}

export interface YtdData {
  baseAmount: number // the base amount every dollar figure here was computed at
  dates: string[]
  series: YtdSeries[]
  totals: Record<YtdKey, YtdTotals>
  perAsset: YtdAsset[]
  asOf: string
}

interface Purchase {
  asset: string // the watchlist asset this buy belongs to
  ticker: string // what was bought: the asset itself, or SPY
  date: string
  amount: number
  price: number
}

const round2 = (v: number) => Math.round(v * 100) / 100

export function buildYtd(
  tickers: string[],
  months: string[],
  feed: Map<string, Record<string, FeedEntry>>,
  bars: Map<string, Map<string, Bar>>, // ticker -> date -> bar, must include SPY
  baseAmount: number,
): YtdData | null {
  const spyBars = bars.get('SPY')
  if (!spyBars || months.length === 0) return null
  const spyDates = Array.from(spyBars.keys()).sort()

  // Fill date for a month with no signal: the day after the month's first trading day
  const fallbackDate = (ym: string): string | null => {
    const i = spyDates.findIndex(d => d.startsWith(ym))
    return i >= 0 && i + 1 < spyDates.length ? spyDates[i + 1] : null
  }
  const openOn = (ticker: string, date: string): number | null => {
    const o = bars.get(ticker)?.get(date)?.open
    return o && o > 0 ? o : null
  }
  const fill = (ticker: string, ym: string): { date: string; price: number } | null => {
    const e = feed.get(ticker)?.[ym]
    if (e && e.entryDate && e.entryPrice && e.entryPrice > 0) return { date: e.entryDate, price: e.entryPrice }
    const date = fallbackDate(ym)
    const price = date ? openOn(ticker, date) : null
    return date && price ? { date, price } : null
  }

  const mlln: Purchase[] = []
  const std: Purchase[] = []
  const spyMirror: Purchase[] = []
  const spyDca: Purchase[] = []

  for (const t of tickers) {
    for (const ym of months) {
      const f = fill(t, ym)
      if (!f) continue
      std.push({ asset: t, ticker: t, date: f.date, amount: baseAmount, price: f.price })
      const mult = feed.get(t)?.[ym]?.mult
      if (mult === undefined || !(mult > 0)) continue
      const amount = round2(baseAmount * mult)
      mlln.push({ asset: t, ticker: t, date: f.date, amount, price: f.price })
      const spy = openOn('SPY', f.date)
      if (spy) spyMirror.push({ asset: t, ticker: 'SPY', date: f.date, amount, price: spy })
    }
  }
  for (const ym of months) {
    const date = fallbackDate(ym)
    const price = date ? openOn('SPY', date) : null
    if (date && price) spyDca.push({ asset: 'SPY', ticker: 'SPY', date, amount: baseAmount * tickers.length, price })
  }

  const all = [...mlln, ...std, ...spyMirror, ...spyDca]
  if (all.length === 0) return null
  const first = all.reduce((m, p) => (p.date < m ? p.date : m), all[0].date)
  const dates = spyDates.filter(d => d >= first)
  if (dates.length === 0) return null

  // Close for each ticker on each date, carrying the last close over a missing day
  const closeAt = new Map<string, number[]>()
  for (const t of [...tickers, 'SPY']) {
    const b = bars.get(t)
    let last = NaN
    closeAt.set(t, dates.map(d => {
      const c = b?.get(d)?.close
      if (c && c > 0) last = c
      return last
    }))
  }

  const valueAt = (purchases: Purchase[], di: number): { invested: number; value: number } => {
    let invested = 0, value = 0
    for (const p of purchases) {
      if (p.date > dates[di]) continue
      const close = closeAt.get(p.ticker)?.[di]
      if (close === undefined || Number.isNaN(close)) continue
      invested += p.amount
      value += (p.amount / p.price) * close
    }
    return { invested, value }
  }

  const sets: Record<YtdKey, Purchase[]> = { mlln, std, spyMirror, spyDca }
  const keys: YtdKey[] = ['mlln', 'std', 'spyMirror', 'spyDca']
  const series: YtdSeries[] = keys.map(key => ({
    key,
    ret: dates.map((_, di) => {
      const { invested, value } = valueAt(sets[key], di)
      return invested > 0 ? round2((value / invested - 1) * 100) : null
    }),
  }))

  const last = dates.length - 1
  const total = (p: Purchase[]): YtdTotals | null => {
    const { invested, value } = valueAt(p, last)
    return invested > 0 ? { invested: round2(invested), value: round2(value) } : null
  }
  const zero: YtdTotals = { invested: 0, value: 0 }
  const totals = Object.fromEntries(keys.map(k => [k, total(sets[k]) ?? zero])) as Record<YtdKey, YtdTotals>

  const perAsset: YtdAsset[] = tickers.map(t => ({
    ticker: t,
    mlln: total(mlln.filter(p => p.asset === t)),
    std: total(std.filter(p => p.asset === t)),
    spyMirror: total(spyMirror.filter(p => p.asset === t)),
  }))

  return { baseAmount, dates, series, totals, perAsset, asOf: dates[last] }
}
