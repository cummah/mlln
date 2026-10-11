import { getTickerSummary } from '@/lib/ticker/summary'

export interface BacktestSummary {
  ticker: string
  name: string
  sector: string
  backtest_start_year: number
  // Full date (not just year) of the first available price bar — lets callers tell
  // whether a "3 Year"/"5 Year" window is real history or a same-as-1Y fallback for
  // recently-listed tickers. Null when unknown (legacy live-compute fallback path).
  backtest_start_date: string | null

  stdReturn1m: number
  enhReturn1m: number
  alpha1m: number
  stdInvested1m: number
  enhInvested1m: number
  stdValue1m: number
  enhValue1m: number
  stdPurchases1m: number
  enhPurchases1m: number

  monthlyStdReturn1m: number
  monthlyEnhReturn1m: number
  monthlyAlpha1m: number
  monthlyStdInvested1m: number
  monthlyEnhInvested1m: number
  monthlyStdValue1m: number
  monthlyEnhValue1m: number
  monthlyStdPurchases1m: number
  monthlyEnhPurchases1m: number
  monthlySkipped1m: number

  stdReturn3m: number
  enhReturn3m: number
  alpha3m: number
  stdInvested3m: number
  enhInvested3m: number
  stdValue3m: number
  enhValue3m: number
  stdPurchases3m: number
  enhPurchases3m: number

  monthlyStdReturn3m: number
  monthlyEnhReturn3m: number
  monthlyAlpha3m: number
  monthlyStdInvested3m: number
  monthlyEnhInvested3m: number
  monthlyStdValue3m: number
  monthlyEnhValue3m: number
  monthlyStdPurchases3m: number
  monthlyEnhPurchases3m: number
  monthlySkipped3m: number

  stdReturn1y: number
  enhReturn1y: number
  alpha1y: number
  stdInvested1y: number
  enhInvested1y: number
  stdValue1y: number
  enhValue1y: number
  stdPurchases1y: number
  enhPurchases1y: number
  stdAvgEntry1y: number
  enhAvgEntry1y: number
  stdShares1y: number
  enhShares1y: number

  // Monthly DCA results for 1Y
  monthlyStdReturn1y: number
  monthlyEnhReturn1y: number
  monthlyAlpha1y: number
  monthlyStdInvested1y: number
  monthlyEnhInvested1y: number
  monthlyStdValue1y: number
  monthlyEnhValue1y: number
  monthlyStdAvgEntry1y: number
  monthlyEnhAvgEntry1y: number
  monthlyStdPurchases1y: number
  monthlyEnhPurchases1y: number
  monthlySkipped1y: number

  stdReturn3y: number
  enhReturn3y: number
  alpha3y: number
  stdInvested3y: number
  enhInvested3y: number
  stdValue3y: number
  enhValue3y: number
  stdPurchases3y: number
  enhPurchases3y: number
  stdAvgEntry3y: number
  enhAvgEntry3y: number
  stdShares3y: number
  enhShares3y: number

  // Monthly DCA results for 3Y
  monthlyStdReturn3y: number
  monthlyEnhReturn3y: number
  monthlyAlpha3y: number
  monthlyStdInvested3y: number
  monthlyEnhInvested3y: number
  monthlyStdValue3y: number
  monthlyEnhValue3y: number
  monthlyStdAvgEntry3y: number
  monthlyEnhAvgEntry3y: number
  monthlyStdPurchases3y: number
  monthlyEnhPurchases3y: number
  monthlySkipped3y: number

  stdReturn5y: number
  enhReturn5y: number
  alpha5y: number
  stdInvested5y: number
  enhInvested5y: number
  stdValue5y: number
  enhValue5y: number
  stdPurchases5y: number
  enhPurchases5y: number
  stdAvgEntry5y: number
  enhAvgEntry5y: number
  stdShares5y: number
  enhShares5y: number

  // Monthly DCA results for 5Y
  monthlyStdReturn5y: number
  monthlyEnhReturn5y: number
  monthlyAlpha5y: number
  monthlyStdInvested5y: number
  monthlyEnhInvested5y: number
  monthlyStdValue5y: number
  monthlyEnhValue5y: number
  monthlyStdAvgEntry5y: number
  monthlyEnhAvgEntry5y: number
  monthlyStdPurchases5y: number
  monthlyEnhPurchases5y: number
  monthlySkipped5y: number

  updated_at: string
  dca_suitability_score: number | null
}

/**
 * One ticker's backtest summary, read from the table the nightly job rebuilds. There is no live recompute and no
 * fallback: a ticker without a row has no summary, and a window without enough history is marked unavailable
 * (see TickerSummary.available) instead of being returned as zero.
 */
export async function getBacktestSummary(ticker: string) {
  return getTickerSummary(ticker)
}
