import YahooFinance from 'yahoo-finance2'

export function createYahooFinanceClient() {
  return new YahooFinance({ suppressNotices: ['ripHistorical'] })
}

const NULL_VALUES_ERROR = 'SOME (but not all) null values'

async function fetchHistoricalWindow(
  yf: ReturnType<typeof createYahooFinanceClient>,
  symbol: string,
  period1: Date,
  period2: Date,
  maxRetries: number
): Promise<any[]> {
  const end = new Date(period2)
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (end < period1) return []
    try {
      const result = await yf.historical(symbol, { period1, period2: end, interval: '1d' })
      return result || []
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.includes(NULL_VALUES_ERROR) || attempt === maxRetries) throw err
      end.setDate(end.getDate() - 1)
    }
  }
  return []
}

/**
 * yahoo-finance2's historical() validates the whole response and throws if ANY
 * bar has a null close — which happens for the most recent trading day before
 * Yahoo finalizes it. That throw discards all the good data along with the one
 * bad bar, silently zeroing out an entire ticker's fetch. Retry with the window
 * trimmed back a day at a time until a clean range is found.
 *
 * Dual-class share tickers (BRK.A, LEN.B, ...) are stored dotted in our DB but
 * Yahoo indexes them with a hyphen (BRK-A, LEN-B). If the dotted symbol fails
 * outright, retry once with the hyphenated form before giving up.
 */
export async function fetchHistoricalSafe(
  yf: ReturnType<typeof createYahooFinanceClient>,
  ticker: string,
  period1: Date,
  period2: Date,
  maxRetries = 5
): Promise<any[]> {
  try {
    return await fetchHistoricalWindow(yf, ticker, period1, period2, maxRetries)
  } catch (err) {
    if (!ticker.includes('.')) throw err
    return await fetchHistoricalWindow(yf, ticker.replace('.', '-'), period1, period2, maxRetries)
  }
}
