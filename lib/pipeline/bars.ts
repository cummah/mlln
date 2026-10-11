// Loading price bars. Bars with any missing field are dropped here, once, instead of being
// patched around later: a missing bar is honest, an invented one is not.

import type { Bar } from '../engine/config'
import { getDb, pagedSelect, pool, withRetry } from './db'

export function toBars(rows: any[]): Bar[] {
  const out: Bar[] = []
  for (const r of rows) {
    if (r.close == null || r.open == null || r.high == null || r.low == null) continue
    const close = +r.close
    if (!(close > 0)) continue
    out.push({ date: r.date, open: +r.open, high: +r.high, low: +r.low, close })
  }
  return out
}

/** Entire stored history for a ticker, oldest first. */
export async function loadAllBars(ticker: string): Promise<Bar[]> {
  const rows = await pagedSelect<any>(`bars ${ticker}`, (from, to) =>
    getDb().from('daily_prices').select('date, open, high, low, close').eq('ticker', ticker).order('date', { ascending: true }).range(from, to))
  return toBars(rows)
}

/** The latest `n` bars, oldest first, in one request (n must be at most 1000). */
export async function loadRecentBars(ticker: string, n = 1000): Promise<Bar[]> {
  const rows = await withRetry(`recent bars ${ticker}`, async () => {
    const { data, error } = await getDb().from('daily_prices').select('date, open, high, low, close')
      .eq('ticker', ticker).order('date', { ascending: false }).limit(Math.min(n, 1000))
    if (error) throw new Error(error.message)
    return data as any[]
  })
  return toBars(rows.slice().reverse())
}

export async function loadMany(
  tickers: string[],
  loader: (t: string) => Promise<Bar[]>,
  concurrency = 8,
  onProgress?: (done: number, total: number) => void
): Promise<Map<string, Bar[]>> {
  const out = new Map<string, Bar[]>()
  let done = 0
  await pool(tickers, concurrency, async t => {
    out.set(t, await loader(t))
    done++
    if (onProgress && done % 100 === 0) onProgress(done, tickers.length)
  })
  return out
}

export async function activeTickers(): Promise<string[]> {
  const rows = await pagedSelect<any>('active assets', (from, to) =>
    getDb().from('assets').select('ticker').eq('is_active', true).order('ticker').range(from, to))
  return rows.map(r => r.ticker as string).filter(t => !t.startsWith('^'))
}
