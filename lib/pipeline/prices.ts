// Nightly price update. One code path, no copies.
//
// Differences from the old updaters, each because of a failure that happened:
//  - Yahoo's period2 is EXCLUSIVE, so the end date is tomorrow. The old code passed yesterday and
//    always stopped two trading days back.
//  - A bar dated today is dropped if the US market has not closed, so a half-finished bar is never stored.
//  - The last stored bar is fetched again and compared. Yahoo restates history after a split, and
//    leaving old bars unadjusted makes a split look like a 50 percent crash. A mismatch rebuilds the ticker.
//  - ^VIX is fetched explicitly. It was marked inactive and silently stopped updating on 4 September.

import { createYahooFinanceClient, fetchHistoricalSafe } from '../yahoo-prices'
import { getDb, pagedSelect, pool, upsertChunks, withRetry } from './db'

export const PRICE_START = '2021-01-01'
const RESTATE_TOLERANCE = 0.005
const OVERLAP_DAYS = 5

export interface PriceUpdate {
  newBars: number
  restated: string[]
  corrected: string[] // newest stored bar was unfinished and has been overwritten
  failed: { ticker: string; error: string }[]
  latest: Map<string, { date: string; close: number; prev: number | null }>
}

interface DbBar {
  ticker: string
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

function shiftDate(date: string, days: number): string {
  return new Date(new Date(date + 'T12:00:00Z').getTime() + days * 86400000).toISOString().slice(0, 10)
}

/** Today's date and minutes since midnight in New York. */
function newYorkNow(): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const get = (t: string) => parts.find(p => p.type === t)!.value
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: (+get('hour') % 24) * 60 + +get('minute') }
}

function normalise(ticker: string, rows: any[], dropToday: string | null): DbBar[] {
  const out: DbBar[] = []
  for (const r of rows ?? []) {
    const open = Number(r.open), high = Number(r.high), low = Number(r.low), close = Number(r.close)
    if (![open, high, low, close].every(v => Number.isFinite(v) && v > 0)) continue
    const date = new Date(r.date).toISOString().slice(0, 10)
    if (dropToday && date === dropToday) continue
    out.push({ ticker, date, open, high, low, close, volume: Number.isFinite(Number(r.volume)) ? Number(r.volume) : 0 })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

export async function updatePrices(tickers: string[], concurrency = 6, onProgress?: (done: number, total: number) => void): Promise<PriceUpdate> {
  const db = getDb()
  const yf = createYahooFinanceClient()
  const ny = newYorkNow()
  const dropToday = ny.minutes < 16 * 60 + 30 ? ny.date : null
  const tomorrow = new Date(Date.now() + 86400000)

  // Where each ticker's stored history ends
  const lp = await pagedSelect<any>('latest_prices', (from, to) => db.from('latest_prices').select('ticker, price_date, close').range(from, to))
  const stored = new Map<string, { date: string; close: number }>(lp.map(r => [r.ticker as string, { date: r.price_date as string, close: +r.close }]))
  const missing = tickers.filter(t => !stored.has(t))
  await pool(missing, 10, async t => {
    const { data, error } = await db.from('daily_prices').select('date, close').eq('ticker', t).order('date', { ascending: false }).limit(1)
    if (error) throw new Error(`latest bar for ${t}: ${error.message}`)
    if (data?.length) stored.set(t, { date: (data[0] as any).date, close: +(data[0] as any).close })
  })

  const result: PriceUpdate = { newBars: 0, restated: [], corrected: [], failed: [], latest: new Map() }
  let done = 0

  await pool(tickers, concurrency, async ticker => {
    try {
      const last = stored.get(ticker)
      const from = last ? shiftDate(last.date, -OVERLAP_DAYS) : PRICE_START
      const raw = await fetchHistoricalSafe(yf, ticker, new Date(from + 'T00:00:00Z'), tomorrow)
      let bars = normalise(ticker, raw, dropToday)

      // The bar we hold no longer matches Yahoo's. Two very different causes:
      //  - only the newest stored bar differs: it was saved before the day was final (this is how
      //    the stored 4 September VIX close came to be 14.16 against a final 14.53). Overwrite it.
      //  - the earlier bars differ too, by a consistent ratio: a split, so rebuild the whole history.
      let restate = false
      let correct = false
      if (last) {
        const ref = bars.find(b => b.date === last.date)
        if (ref && Math.abs(ref.close / last.close - 1) > RESTATE_TOLERANCE) {
          correct = true
          const { data, error } = await db.from('daily_prices').select('date, close')
            .eq('ticker', ticker).gte('date', from).lt('date', last.date)
          if (error) throw new Error(`overlap check ${ticker}: ${error.message}`)
          const earlier = (data as any[]) ?? []
          const byDate = new Map(bars.map(b => [b.date, b.close]))
          const compared = earlier.filter(r => byDate.has(r.date))
          const differing = compared.filter(r => Math.abs(byDate.get(r.date)! / +r.close - 1) > RESTATE_TOLERANCE)
          restate = compared.length >= 2 && differing.length === compared.length
        }
      }
      if (restate) {
        const all = await fetchHistoricalSafe(yf, ticker, new Date(PRICE_START + 'T00:00:00Z'), tomorrow)
        bars = normalise(ticker, all, dropToday)
        if (bars.length < 250) throw new Error(`restated history for ${ticker} has only ${bars.length} bars, refusing to replace`)
        await withRetry(`clear ${ticker}`, async () => { const { error } = await db.from('daily_prices').delete().eq('ticker', ticker); if (error) throw new Error(error.message) })
        await upsertChunks('daily_prices', bars, 'ticker,date', 1000)
        result.restated.push(ticker)
        result.newBars += bars.length
      } else {
        const fresh = last ? bars.filter(b => b.date > last.date) : bars
        // When the newest stored bar was unfinished, overwrite the whole overlap with final values
        const toWrite = correct ? bars : fresh
        if (toWrite.length) {
          await upsertChunks('daily_prices', toWrite, 'ticker,date', 1000)
          result.newBars += fresh.length
          if (correct) result.corrected.push(ticker)
        }
      }

      const newest = bars[bars.length - 1]
      if (newest && (!last || restate || newest.date > last.date)) {
        const prevBar = bars[bars.length - 2]
        result.latest.set(ticker, { date: newest.date, close: newest.close, prev: prevBar ? prevBar.close : last ? last.close : null })
      }
    } catch (err) {
      result.failed.push({ ticker, error: err instanceof Error ? err.message : String(err) })
    } finally {
      done++
      if (onProgress && done % 200 === 0) onProgress(done, tickers.length)
    }
  })

  // The lookup table the pages read to mark positions to market
  const rows = Array.from(result.latest.entries()).map(([ticker, v]) => ({
    ticker, price_date: v.date, close: v.close, prev_close: v.prev, updated_at: new Date().toISOString(),
  }))
  await upsertChunks('latest_prices', rows, 'ticker')
  return result
}
