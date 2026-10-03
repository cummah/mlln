import { getSupabaseClient } from '@/lib/supabase'

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

export async function getBacktestSummary(ticker: string): Promise<BacktestSummary | null> {
  try {
    // 1. Try to load from cached backtest_summary table
    const { data: rowData, error: dbError } = await getSupabaseClient()
      .from('backtest_summary')
      .select('*')
      .eq('ticker', ticker.toUpperCase())
      .single()

    const row = rowData as any

    if (!dbError && row) {
      // Check staleness
      const updatedAt = new Date(row.updated_at)
      const now = new Date()
      const daysSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceUpdate > 8) {
        console.warn(`Backtest cache for ${ticker} is stale (${daysSinceUpdate.toFixed(1)} days old), but serving cached data`)
      }

      // Map DB snake_case to BacktestSummary camelCase
      return {
        ticker: row.ticker,
        name: row.name,
        sector: row.sector,
        backtest_start_year: row.backtest_start ? new Date(row.backtest_start).getFullYear() : 2020,
        backtest_start_date: row.backtest_start || null,

        stdReturn1m: row.std_return_1m || 0,
        enhReturn1m: row.enh_return_1m || 0,
        alpha1m: row.alpha_1m || 0,
        stdInvested1m: row.std_invested_1m || 0,
        enhInvested1m: row.enh_invested_1m || 0,
        stdValue1m: row.std_value_1m || 0,
        enhValue1m: row.enh_value_1m || 0,
        stdPurchases1m: row.std_purchases_1m || 0,
        enhPurchases1m: row.enh_purchases_1m || 0,

        monthlyStdReturn1m: row.monthly_std_return_1m || 0,
        monthlyEnhReturn1m: row.monthly_enh_return_1m || 0,
        monthlyAlpha1m: row.monthly_alpha_1m || 0,
        monthlyStdInvested1m: row.monthly_std_invested_1m || 0,
        monthlyEnhInvested1m: row.monthly_enh_invested_1m || 0,
        monthlyStdValue1m: row.monthly_std_value_1m || 0,
        monthlyEnhValue1m: row.monthly_enh_value_1m || 0,
        monthlyStdPurchases1m: row.monthly_std_purchases_1m || 0,
        monthlyEnhPurchases1m: row.monthly_enh_purchases_1m || 0,
        monthlySkipped1m: row.monthly_skipped_1m || 0,

        stdReturn3m: row.std_return_3m || 0,
        enhReturn3m: row.enh_return_3m || 0,
        alpha3m: row.alpha_3m || 0,
        stdInvested3m: row.std_invested_3m || 0,
        enhInvested3m: row.enh_invested_3m || 0,
        stdValue3m: row.std_value_3m || 0,
        enhValue3m: row.enh_value_3m || 0,
        stdPurchases3m: row.std_purchases_3m || 0,
        enhPurchases3m: row.enh_purchases_3m || 0,

        monthlyStdReturn3m: row.monthly_std_return_3m || 0,
        monthlyEnhReturn3m: row.monthly_enh_return_3m || 0,
        monthlyAlpha3m: row.monthly_alpha_3m || 0,
        monthlyStdInvested3m: row.monthly_std_invested_3m || 0,
        monthlyEnhInvested3m: row.monthly_enh_invested_3m || 0,
        monthlyStdValue3m: row.monthly_std_value_3m || 0,
        monthlyEnhValue3m: row.monthly_enh_value_3m || 0,
        monthlyStdPurchases3m: row.monthly_std_purchases_3m || 0,
        monthlyEnhPurchases3m: row.monthly_enh_purchases_3m || 0,
        monthlySkipped3m: row.monthly_skipped_3m || 0,

        stdReturn1y: row.std_return_1y || 0,
        enhReturn1y: row.enh_return_1y || 0,
        alpha1y: row.alpha_1y || 0,
        stdInvested1y: row.std_invested_1y || 0,
        enhInvested1y: row.enh_invested_1y || 0,
        stdValue1y: row.std_value_1y || 0,
        enhValue1y: row.enh_value_1y || 0,
        stdPurchases1y: row.std_purchases_1y || 0,
        enhPurchases1y: row.enh_purchases_1y || 0,
        stdAvgEntry1y: row.std_avg_entry_1y || 0,
        enhAvgEntry1y: row.enh_avg_entry_1y || 0,
        stdShares1y: row.std_shares_1y || 0,
        enhShares1y: row.enh_shares_1y || 0,

        monthlyStdReturn1y: row.monthly_std_return_1y || 0,
        monthlyEnhReturn1y: row.monthly_enh_return_1y || 0,
        monthlyAlpha1y: row.monthly_alpha_1y || 0,
        monthlyStdInvested1y: row.monthly_std_invested_1y || 0,
        monthlyEnhInvested1y: row.monthly_enh_invested_1y || 0,
        monthlyStdValue1y: row.monthly_std_value_1y || 0,
        monthlyEnhValue1y: row.monthly_enh_value_1y || 0,
        monthlyStdAvgEntry1y: row.monthly_std_avg_entry_1y || 0,
        monthlyEnhAvgEntry1y: row.monthly_enh_avg_entry_1y || 0,
        monthlyStdPurchases1y: row.monthly_std_purchases_1y || 0,
        monthlyEnhPurchases1y: row.monthly_enh_purchases_1y || 0,
        monthlySkipped1y: row.monthly_skipped_1y || 0,

        stdReturn3y: row.std_return_3y || 0,
        enhReturn3y: row.enh_return_3y || 0,
        alpha3y: row.alpha_3y || 0,
        stdInvested3y: row.std_invested_3y || 0,
        enhInvested3y: row.enh_invested_3y || 0,
        stdValue3y: row.std_value_3y || 0,
        enhValue3y: row.enh_value_3y || 0,
        stdPurchases3y: row.std_purchases_3y || 0,
        enhPurchases3y: row.enh_purchases_3y || 0,
        stdAvgEntry3y: row.std_avg_entry_3y || 0,
        enhAvgEntry3y: row.enh_avg_entry_3y || 0,
        stdShares3y: row.std_shares_3y || 0,
        enhShares3y: row.enh_shares_3y || 0,

        monthlyStdReturn3y: row.monthly_std_return_3y || 0,
        monthlyEnhReturn3y: row.monthly_enh_return_3y || 0,
        monthlyAlpha3y: row.monthly_alpha_3y || 0,
        monthlyStdInvested3y: row.monthly_std_invested_3y || 0,
        monthlyEnhInvested3y: row.monthly_enh_invested_3y || 0,
        monthlyStdValue3y: row.monthly_std_value_3y || 0,
        monthlyEnhValue3y: row.monthly_enh_value_3y || 0,
        monthlyStdAvgEntry3y: row.monthly_std_avg_entry_3y || 0,
        monthlyEnhAvgEntry3y: row.monthly_enh_avg_entry_3y || 0,
        monthlyStdPurchases3y: row.monthly_std_purchases_3y || 0,
        monthlyEnhPurchases3y: row.monthly_enh_purchases_3y || 0,
        monthlySkipped3y: row.monthly_skipped_3y || 0,

        stdReturn5y: row.std_return_5y || 0,
        enhReturn5y: row.enh_return_5y || 0,
        alpha5y: row.alpha_5y || 0,
        stdInvested5y: row.std_invested_5y || 0,
        enhInvested5y: row.enh_invested_5y || 0,
        stdValue5y: row.std_value_5y || 0,
        enhValue5y: row.enh_value_5y || 0,
        stdPurchases5y: row.std_purchases_5y || 0,
        enhPurchases5y: row.enh_purchases_5y || 0,
        stdAvgEntry5y: row.std_avg_entry_5y || 0,
        enhAvgEntry5y: row.enh_avg_entry_5y || 0,
        stdShares5y: row.std_shares_5y || 0,
        enhShares5y: row.enh_shares_5y || 0,

        monthlyStdReturn5y: row.monthly_std_return_5y || 0,
        monthlyEnhReturn5y: row.monthly_enh_return_5y || 0,
        monthlyAlpha5y: row.monthly_alpha_5y || 0,
        monthlyStdInvested5y: row.monthly_std_invested_5y || 0,
        monthlyEnhInvested5y: row.monthly_enh_invested_5y || 0,
        monthlyStdValue5y: row.monthly_std_value_5y || 0,
        monthlyEnhValue5y: row.monthly_enh_value_5y || 0,
        monthlyStdAvgEntry5y: row.monthly_std_avg_entry_5y || 0,
        monthlyEnhAvgEntry5y: row.monthly_enh_avg_entry_5y || 0,
        monthlyStdPurchases5y: row.monthly_std_purchases_5y || 0,
        monthlyEnhPurchases5y: row.monthly_enh_purchases_5y || 0,
        monthlySkipped5y: row.monthly_skipped_5y || 0,

        updated_at: row.updated_at,
        dca_suitability_score: row.dca_suitability_score ?? null,
      }
    }

    // 2. Fallback to dynamic API computation if cache not found
    console.warn(`Cache miss for ${ticker}, computing from API...`)
    const host = process.env.VERCEL_URL || `localhost:${process.env.PORT || 3000}`
    const protocol = process.env.VERCEL_URL ? 'https' : 'http'

    // Fetch asset info
    const { data: assetData } = await getSupabaseClient()
      .from('assets')
      .select('ticker, name, sector')
      .eq('ticker', ticker.toUpperCase())
      .single()

    const asset = assetData as { ticker: string; name: string; sector: string } | null

    if (!asset) return null

    // Helper to safely get nested values
    const getField = (obj: any, ...path: string[]): number => {
      let current = obj
      for (const key of path) {
        current = current?.[key]
      }
      return typeof current === 'number' ? current : 0
    }

    // Helper to extract metrics from backtest data
    const extractMetrics = (backtest: any) => {
      const stdProfit = getField(backtest, 'std', 'netProfitPct') ||
                        getField(backtest, 'standard', 'netProfitPct') || 0
      const enhProfit = getField(backtest, 'enh', 'netProfitPct') ||
                        getField(backtest, 'enhanced', 'netProfitPct') || 0
      const stdInvested = getField(backtest, 'std', 'totalInvested') ||
                          getField(backtest, 'standard', 'totalInvested') || 0
      const enhInvested = getField(backtest, 'enh', 'totalInvested') ||
                          getField(backtest, 'enhanced', 'totalInvested') || 0
      const stdValue = getField(backtest, 'std', 'currentValue') ||
                       getField(backtest, 'standard', 'currentValue') || 0
      const enhValue = getField(backtest, 'enh', 'currentValue') ||
                       getField(backtest, 'enhanced', 'currentValue') || 0
      const stdAvgEntry = getField(backtest, 'std', 'avgEntry') ||
                          getField(backtest, 'standard', 'avgEntry') || 0
      const enhAvgEntry = getField(backtest, 'enh', 'avgEntry') ||
                          getField(backtest, 'enhanced', 'avgEntry') || 0
      const stdShares = getField(backtest, 'std', 'totalShares') ||
                        getField(backtest, 'standard', 'totalShares') || 0
      const enhShares = getField(backtest, 'enh', 'totalShares') ||
                        getField(backtest, 'enhanced', 'totalShares') || 0

      return {
        stdReturn: stdProfit,
        enhReturn: enhProfit,
        alpha: enhProfit - stdProfit,
        stdInvested,
        enhInvested,
        stdValue,
        enhValue,
        stdPurchases: 0, // Will be set from API response
        enhPurchases: 0, // Will be set from API response
        stdAvgEntry,
        enhAvgEntry,
        stdShares,
        enhShares,
        monthlyStdReturn: 0,
        monthlyEnhReturn: 0,
        monthlyAlpha: 0,
        monthlyStdInvested: 0,
        monthlyEnhInvested: 0,
        monthlyStdValue: 0,
        monthlyEnhValue: 0,
      }
    }

    // Fetch all five windows in parallel
    const windows = ['1m', '3m', '1y', '3y', '5y'] as const
    const results: Record<string, any> = {}

    const fetchPromises = windows.map(async (window) => {
      try {
        const response = await fetch(`${protocol}://${host}/api/signal/${ticker}?window=${window}`, {
          next: { revalidate: 3600 },
        })

        if (!response.ok) {
          console.error(`API signal response not ok for ${ticker} ${window}: ${response.status}`)
          return
        }

        const data = await response.json()
        const weeklyBacktest = data.weekly?.backtest
        const monthlyBacktest = data.monthly?.backtest
        const enhancedBacktest = data.tv?.backtest
        const purchaseCounts = data.tv?.purchaseCounts

        if (weeklyBacktest && enhancedBacktest) {
          const metrics = extractMetrics(weeklyBacktest)
          // Use actual purchase counts from API
          if (purchaseCounts) {
            metrics.stdPurchases = purchaseCounts.std
            metrics.enhPurchases = purchaseCounts.enh
          }

          // Also extract monthly metrics if available
          if (monthlyBacktest) {
            const monthlyMetrics = extractMetrics(monthlyBacktest)
            metrics.monthlyStdReturn = monthlyMetrics.stdReturn
            metrics.monthlyEnhReturn = monthlyMetrics.enhReturn
            metrics.monthlyAlpha = monthlyMetrics.alpha
            metrics.monthlyStdInvested = monthlyMetrics.stdInvested
            metrics.monthlyEnhInvested = monthlyMetrics.enhInvested
            metrics.monthlyStdValue = monthlyMetrics.stdValue
            metrics.monthlyEnhValue = monthlyMetrics.enhValue
          }

          results[window] = metrics
        } else {
          console.error(`Missing backtest data for ${ticker} ${window}`)
        }
      } catch (err) {
        console.error(`Error fetching ${window} backtest for ${ticker}:`, err)
      }
    })

    await Promise.all(fetchPromises)

    // Check if we got data for at least 5Y
    if (!results['5y']) {
      console.error(`No 5Y backtest data available for ${ticker}`)
      return null
    }

    // Use 5Y as fallback for any missing windows
    const m1m = results['1m'] || results['5y']
    const m3m = results['3m'] || results['5y']
    const m1y = results['1y'] || results['5y']
    const m3y = results['3y'] || results['5y']
    const m5y = results['5y']

    return {
      ticker: asset.ticker,
      name: asset.name,
      sector: asset.sector,
      backtest_start_year: 2020,
      backtest_start_date: null,

      stdReturn1m: m1m.stdReturn,
      enhReturn1m: m1m.enhReturn,
      alpha1m: m1m.alpha,
      stdInvested1m: m1m.stdInvested,
      enhInvested1m: m1m.enhInvested,
      stdValue1m: m1m.stdValue,
      enhValue1m: m1m.enhValue,
      stdPurchases1m: m1m.stdPurchases,
      enhPurchases1m: m1m.enhPurchases,

      monthlyStdReturn1m: m1m.monthlyStdReturn,
      monthlyEnhReturn1m: m1m.monthlyEnhReturn,
      monthlyAlpha1m: m1m.alpha,
      monthlyStdInvested1m: m1m.monthlyStdInvested,
      monthlyEnhInvested1m: m1m.monthlyEnhInvested,
      monthlyStdValue1m: m1m.monthlyStdValue,
      monthlyEnhValue1m: m1m.monthlyEnhValue,
      monthlyStdPurchases1m: 0,
      monthlyEnhPurchases1m: 0,
      monthlySkipped1m: 0,

      stdReturn3m: m3m.stdReturn,
      enhReturn3m: m3m.enhReturn,
      alpha3m: m3m.alpha,
      stdInvested3m: m3m.stdInvested,
      enhInvested3m: m3m.enhInvested,
      stdValue3m: m3m.stdValue,
      enhValue3m: m3m.enhValue,
      stdPurchases3m: m3m.stdPurchases,
      enhPurchases3m: m3m.enhPurchases,

      monthlyStdReturn3m: m3m.monthlyStdReturn,
      monthlyEnhReturn3m: m3m.monthlyEnhReturn,
      monthlyAlpha3m: m3m.alpha,
      monthlyStdInvested3m: m3m.monthlyStdInvested,
      monthlyEnhInvested3m: m3m.monthlyEnhInvested,
      monthlyStdValue3m: m3m.monthlyStdValue,
      monthlyEnhValue3m: m3m.monthlyEnhValue,
      monthlyStdPurchases3m: 0,
      monthlyEnhPurchases3m: 0,
      monthlySkipped3m: 0,

      stdReturn1y: m1y.stdReturn,
      enhReturn1y: m1y.enhReturn,
      alpha1y: m1y.alpha,
      stdInvested1y: m1y.stdInvested,
      enhInvested1y: m1y.enhInvested,
      stdValue1y: m1y.stdValue,
      enhValue1y: m1y.enhValue,
      stdPurchases1y: m1y.stdPurchases,
      enhPurchases1y: m1y.enhPurchases,
      stdAvgEntry1y: m1y.stdAvgEntry,
      enhAvgEntry1y: m1y.enhAvgEntry,
      stdShares1y: m1y.stdShares,
      enhShares1y: m1y.enhShares,

      monthlyStdReturn1y: m1y.monthlyStdReturn || 0,
      monthlyEnhReturn1y: m1y.monthlyEnhReturn || 0,
      monthlyAlpha1y: m1y.monthlyAlpha || 0,
      monthlyStdInvested1y: m1y.monthlyStdInvested || 0,
      monthlyEnhInvested1y: m1y.monthlyEnhInvested || 0,
      monthlyStdValue1y: m1y.monthlyStdValue || 0,
      monthlyEnhValue1y: m1y.monthlyEnhValue || 0,
      monthlyStdAvgEntry1y: m1y.monthlyStdAvgEntry || 0,
      monthlyEnhAvgEntry1y: m1y.monthlyEnhAvgEntry || 0,
      monthlyStdPurchases1y: 0,
      monthlyEnhPurchases1y: 0,
      monthlySkipped1y: 0,

      stdReturn3y: m3y.stdReturn,
      enhReturn3y: m3y.enhReturn,
      alpha3y: m3y.alpha,
      stdInvested3y: m3y.stdInvested,
      enhInvested3y: m3y.enhInvested,
      stdValue3y: m3y.stdValue,
      enhValue3y: m3y.enhValue,
      stdPurchases3y: m3y.stdPurchases,
      enhPurchases3y: m3y.enhPurchases,
      stdAvgEntry3y: m3y.stdAvgEntry,
      enhAvgEntry3y: m3y.enhAvgEntry,
      stdShares3y: m3y.stdShares,
      enhShares3y: m3y.enhShares,

      monthlyStdReturn3y: m3y.monthlyStdReturn || 0,
      monthlyEnhReturn3y: m3y.monthlyEnhReturn || 0,
      monthlyAlpha3y: m3y.monthlyAlpha || 0,
      monthlyStdInvested3y: m3y.monthlyStdInvested || 0,
      monthlyEnhInvested3y: m3y.monthlyEnhInvested || 0,
      monthlyStdValue3y: m3y.monthlyStdValue || 0,
      monthlyEnhValue3y: m3y.monthlyEnhValue || 0,
      monthlyStdAvgEntry3y: m3y.monthlyStdAvgEntry || 0,
      monthlyEnhAvgEntry3y: m3y.monthlyEnhAvgEntry || 0,
      monthlyStdPurchases3y: 0,
      monthlyEnhPurchases3y: 0,
      monthlySkipped3y: 0,

      stdReturn5y: m5y.stdReturn,
      enhReturn5y: m5y.enhReturn,
      alpha5y: m5y.alpha,
      stdInvested5y: m5y.stdInvested,
      enhInvested5y: m5y.enhInvested,
      stdValue5y: m5y.stdValue,
      enhValue5y: m5y.enhValue,
      stdPurchases5y: m5y.stdPurchases,
      enhPurchases5y: m5y.enhPurchases,
      stdAvgEntry5y: m5y.stdAvgEntry,
      enhAvgEntry5y: m5y.enhAvgEntry,
      stdShares5y: m5y.stdShares,
      enhShares5y: m5y.enhShares,

      monthlyStdReturn5y: m5y.monthlyStdReturn || 0,
      monthlyEnhReturn5y: m5y.monthlyEnhReturn || 0,
      monthlyAlpha5y: m5y.monthlyAlpha || 0,
      monthlyStdInvested5y: m5y.monthlyStdInvested || 0,
      monthlyEnhInvested5y: m5y.monthlyEnhInvested || 0,
      monthlyStdValue5y: m5y.monthlyStdValue || 0,
      monthlyEnhValue5y: m5y.monthlyEnhValue || 0,
      monthlyStdAvgEntry5y: m5y.monthlyStdAvgEntry || 0,
      monthlyEnhAvgEntry5y: m5y.monthlyEnhAvgEntry || 0,
      monthlyStdPurchases5y: 0,
      monthlyEnhPurchases5y: 0,
      monthlySkipped5y: 0,

      updated_at: new Date().toISOString(),
      dca_suitability_score: null,
    }
  } catch (err) {
    console.error('Error getting backtest summary:', err)
    return null
  }
}

export async function getMacroBacktestSummary(ticker: string): Promise<BacktestSummary | null> {
  try {
    const { data: rowData, error: dbError } = await getSupabaseClient()
      .from('backtest_summary_macro')
      .select('*')
      .eq('ticker', ticker.toUpperCase())
      .single()

    const row = rowData as any

    if (!dbError && row) {
      return {
        ticker: row.ticker,
        name: row.name,
        sector: row.sector,
        backtest_start_year: row.backtest_start ? new Date(row.backtest_start).getFullYear() : 2020,
        backtest_start_date: row.backtest_start || null,

        stdReturn1m: row.std_return_1m || 0,
        enhReturn1m: row.enh_return_1m || 0,
        alpha1m: row.alpha_1m || 0,
        stdInvested1m: row.std_invested_1m || 0,
        enhInvested1m: row.enh_invested_1m || 0,
        stdValue1m: row.std_value_1m || 0,
        enhValue1m: row.enh_value_1m || 0,
        stdPurchases1m: row.std_purchases_1m || 0,
        enhPurchases1m: row.enh_purchases_1m || 0,

        monthlyStdReturn1m: row.monthly_std_return_1m || 0,
        monthlyEnhReturn1m: row.monthly_enh_return_1m || 0,
        monthlyAlpha1m: row.monthly_alpha_1m || 0,
        monthlyStdInvested1m: row.monthly_std_invested_1m || 0,
        monthlyEnhInvested1m: row.monthly_enh_invested_1m || 0,
        monthlyStdValue1m: row.monthly_std_value_1m || 0,
        monthlyEnhValue1m: row.monthly_enh_value_1m || 0,
        monthlyStdPurchases1m: row.monthly_std_purchases_1m || 0,
        monthlyEnhPurchases1m: row.monthly_enh_purchases_1m || 0,
        monthlySkipped1m: row.monthly_skipped_1m || 0,

        stdReturn3m: row.std_return_3m || 0,
        enhReturn3m: row.enh_return_3m || 0,
        alpha3m: row.alpha_3m || 0,
        stdInvested3m: row.std_invested_3m || 0,
        enhInvested3m: row.enh_invested_3m || 0,
        stdValue3m: row.std_value_3m || 0,
        enhValue3m: row.enh_value_3m || 0,
        stdPurchases3m: row.std_purchases_3m || 0,
        enhPurchases3m: row.enh_purchases_3m || 0,

        monthlyStdReturn3m: row.monthly_std_return_3m || 0,
        monthlyEnhReturn3m: row.monthly_enh_return_3m || 0,
        monthlyAlpha3m: row.monthly_alpha_3m || 0,
        monthlyStdInvested3m: row.monthly_std_invested_3m || 0,
        monthlyEnhInvested3m: row.monthly_enh_invested_3m || 0,
        monthlyStdValue3m: row.monthly_std_value_3m || 0,
        monthlyEnhValue3m: row.monthly_enh_value_3m || 0,
        monthlyStdPurchases3m: row.monthly_std_purchases_3m || 0,
        monthlyEnhPurchases3m: row.monthly_enh_purchases_3m || 0,
        monthlySkipped3m: row.monthly_skipped_3m || 0,

        stdReturn1y: row.std_return_1y || 0,
        enhReturn1y: row.enh_return_1y || 0,
        alpha1y: row.alpha_1y || 0,
        stdInvested1y: row.std_invested_1y || 0,
        enhInvested1y: row.enh_invested_1y || 0,
        stdValue1y: row.std_value_1y || 0,
        enhValue1y: row.enh_value_1y || 0,
        stdPurchases1y: row.std_purchases_1y || 0,
        enhPurchases1y: row.enh_purchases_1y || 0,
        stdAvgEntry1y: row.std_avg_entry_1y || 0,
        enhAvgEntry1y: row.enh_avg_entry_1y || 0,
        stdShares1y: row.std_shares_1y || 0,
        enhShares1y: row.enh_shares_1y || 0,

        monthlyStdReturn1y: row.monthly_std_return_1y || 0,
        monthlyEnhReturn1y: row.monthly_enh_return_1y || 0,
        monthlyAlpha1y: row.monthly_alpha_1y || 0,
        monthlyStdInvested1y: row.monthly_std_invested_1y || 0,
        monthlyEnhInvested1y: row.monthly_enh_invested_1y || 0,
        monthlyStdValue1y: row.monthly_std_value_1y || 0,
        monthlyEnhValue1y: row.monthly_enh_value_1y || 0,
        monthlyStdAvgEntry1y: row.monthly_std_avg_entry_1y || 0,
        monthlyEnhAvgEntry1y: row.monthly_enh_avg_entry_1y || 0,
        monthlyStdPurchases1y: row.monthly_std_purchases_1y || 0,
        monthlyEnhPurchases1y: row.monthly_enh_purchases_1y || 0,
        monthlySkipped1y: row.monthly_skipped_1y || 0,

        stdReturn3y: row.std_return_3y || 0,
        enhReturn3y: row.enh_return_3y || 0,
        alpha3y: row.alpha_3y || 0,
        stdInvested3y: row.std_invested_3y || 0,
        enhInvested3y: row.enh_invested_3y || 0,
        stdValue3y: row.std_value_3y || 0,
        enhValue3y: row.enh_value_3y || 0,
        stdPurchases3y: row.std_purchases_3y || 0,
        enhPurchases3y: row.enh_purchases_3y || 0,
        stdAvgEntry3y: row.std_avg_entry_3y || 0,
        enhAvgEntry3y: row.enh_avg_entry_3y || 0,
        stdShares3y: row.std_shares_3y || 0,
        enhShares3y: row.enh_shares_3y || 0,

        monthlyStdReturn3y: row.monthly_std_return_3y || 0,
        monthlyEnhReturn3y: row.monthly_enh_return_3y || 0,
        monthlyAlpha3y: row.monthly_alpha_3y || 0,
        monthlyStdInvested3y: row.monthly_std_invested_3y || 0,
        monthlyEnhInvested3y: row.monthly_enh_invested_3y || 0,
        monthlyStdValue3y: row.monthly_std_value_3y || 0,
        monthlyEnhValue3y: row.monthly_enh_value_3y || 0,
        monthlyStdAvgEntry3y: row.monthly_std_avg_entry_3y || 0,
        monthlyEnhAvgEntry3y: row.monthly_enh_avg_entry_3y || 0,
        monthlyStdPurchases3y: row.monthly_std_purchases_3y || 0,
        monthlyEnhPurchases3y: row.monthly_enh_purchases_3y || 0,
        monthlySkipped3y: row.monthly_skipped_3y || 0,

        stdReturn5y: row.std_return_5y || 0,
        enhReturn5y: row.enh_return_5y || 0,
        alpha5y: row.alpha_5y || 0,
        stdInvested5y: row.std_invested_5y || 0,
        enhInvested5y: row.enh_invested_5y || 0,
        stdValue5y: row.std_value_5y || 0,
        enhValue5y: row.enh_value_5y || 0,
        stdPurchases5y: row.std_purchases_5y || 0,
        enhPurchases5y: row.enh_purchases_5y || 0,
        stdAvgEntry5y: row.std_avg_entry_5y || 0,
        enhAvgEntry5y: row.enh_avg_entry_5y || 0,
        stdShares5y: row.std_shares_5y || 0,
        enhShares5y: row.enh_shares_5y || 0,

        monthlyStdReturn5y: row.monthly_std_return_5y || 0,
        monthlyEnhReturn5y: row.monthly_enh_return_5y || 0,
        monthlyAlpha5y: row.monthly_alpha_5y || 0,
        monthlyStdInvested5y: row.monthly_std_invested_5y || 0,
        monthlyEnhInvested5y: row.monthly_enh_invested_5y || 0,
        monthlyStdValue5y: row.monthly_std_value_5y || 0,
        monthlyEnhValue5y: row.monthly_enh_value_5y || 0,
        monthlyStdAvgEntry5y: row.monthly_std_avg_entry_5y || 0,
        monthlyEnhAvgEntry5y: row.monthly_enh_avg_entry_5y || 0,
        monthlyStdPurchases5y: row.monthly_std_purchases_5y || 0,
        monthlyEnhPurchases5y: row.monthly_enh_purchases_5y || 0,
        monthlySkipped5y: row.monthly_skipped_5y || 0,

        updated_at: row.updated_at,
        dca_suitability_score: row.dca_suitability_score ?? null,
      }
    }

    console.warn(`Cache miss for ${ticker} in backtest_summary_macro`)
    return null
  } catch (err) {
    console.error('Error getting macro backtest summary:', err)
    return null
  }
}
