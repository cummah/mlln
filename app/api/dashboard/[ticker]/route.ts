import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'
import { runTVEnhancedDCA, PriceBar } from '@/lib/dcaEngine'

export async function GET(
  request: Request,
  { params }: { params: { ticker: string } }
) {
  try {
    const ticker = params.ticker.toUpperCase()
    const url = new URL(request.url)

    // Parse custom parameters
    const startDateStr = url.searchParams.get('startDate')
    const endDateStr = url.searchParams.get('endDate')
    const dcaAmountStr = url.searchParams.get('dcaAmount')
    const frequency = (url.searchParams.get('frequency') || 'weekly') as 'weekly' | 'monthly'

    // Determine date range
    let startDate = new Date('2021-01-01')
    let endDate = new Date()

    if (startDateStr) {
      startDate = new Date(startDateStr)
    }
    if (endDateStr) {
      endDate = new Date(endDateStr)
    }

    const dcaAmount = dcaAmountStr ? parseFloat(dcaAmountStr) : 100

    // 1. Fetch asset info
    const { data: assetData, error: assetError } = await getSupabaseClient()
      .from('assets')
      .select('ticker, name, sector')
      .eq('ticker', ticker)
      .eq('is_active', true)
      .single()

    const asset = assetData as { ticker: string; name: string; sector: string } | null

    if (assetError || !asset) {
      return NextResponse.json(
        { error: 'Ticker not found or inactive' },
        { status: 404 }
      )
    }

    // 2. Fetch all price bars
    let allPrices: any[] = []
    let page = 0
    const pageSize = 1000

    while (true) {
      const start = page * pageSize
      const end = start + pageSize - 1

      const { data: pageData, error: pageError } = await getSupabaseClient()
        .from('daily_prices')
        .select('date, open, high, low, close, volume')
        .eq('ticker', ticker)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .order('date', { ascending: true })
        .range(start, end)

      if (pageError) {
        return NextResponse.json(
          { error: 'Error fetching price data' },
          { status: 500 }
        )
      }

      if (!pageData || pageData.length === 0) break
      allPrices = allPrices.concat(pageData)
      if (pageData.length < pageSize) break
      page++
    }

    if (!allPrices || allPrices.length === 0) {
      return NextResponse.json(
        { error: 'No price data found for ticker' },
        { status: 404 }
      )
    }

    console.log(`[${ticker}] Fetched ${allPrices.length} bars for date range ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`)

    // 3. Fetch VIX data
    let vixMap = new Map<string, number>()
    try {
      let vixPrices: any[] = []
      let vixPage = 0
      while (true) {
        const start = vixPage * pageSize
        const end = start + pageSize - 1
        const { data: vixData } = await getSupabaseClient()
          .from('daily_prices')
          .select('date, close')
          .eq('ticker', '^VIX')
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0])
          .order('date', { ascending: true })
          .range(start, end)
        if (!vixData || vixData.length === 0) break
        vixPrices = vixPrices.concat(vixData)
        if (vixData.length < pageSize) break
        vixPage++
      }
      vixMap = new Map(vixPrices.map(v => [v.date, Number(v.close)]))
    } catch (err) {
      console.log(`[${ticker}] VIX data not available`)
    }

    // 4. Convert to PriceBar format
    const allBars: PriceBar[] = allPrices.map(p => ({
      date: p.date,
      open: Number(p.open),
      high: Number(p.high),
      low: Number(p.low),
      close: Number(p.close),
      volume: Number(p.volume),
      vix: vixMap.get(p.date),
    }))

    console.log(`[${ticker}] Processing ${allBars.length} bars`)

    // 5. Run both standard and enhanced DCA with custom parameters
    let weeklyResult: any = null
    let monthlyResult: any = null
    let tvResult: any = null

    try {
      if (frequency === 'weekly') {
        tvResult = runTVEnhancedDCA(allBars, {
          rsiLength: 7,
          baseAmount: dcaAmount,
          useVIX: true,
          frequency: 'weekly',
        })
        weeklyResult = tvResult
      } else {
        tvResult = runTVEnhancedDCA(allBars, {
          rsiLength: 14,
          baseAmount: dcaAmount,
          useVIX: true,
          frequency: 'monthly',
        })
        monthlyResult = tvResult
      }
    } catch (err) {
      console.error(`[${ticker}] Error running DCA:`, err)
      return NextResponse.json(
        { error: 'Error running backtest' },
        { status: 500 }
      )
    }

    // 6. Build equity curves from backtest results
    // Extract purchase dates - these are signal dates, purchases execute next bar's open
    // Create a map of execution dates (next trading day after signal)
    const dateToIndex = new Map<string, number>()
    allBars.forEach((bar, idx) => dateToIndex.set(bar.date, idx))

    const stdExecutionDates = new Set<string>()
    const enhExecutionDates = new Set<string>()

    // Standard DCA buys every week/month (track by period key)
    const stdPeriodKeys = new Set<string>()

    if (tvResult?.backtest?.debugDCADays) {
      tvResult.backtest.debugDCADays.forEach((day: any) => {
        // Signal on 'day.date', execution at next bar's open
        const signalIdx = dateToIndex.get(day.date)
        if (signalIdx !== undefined && signalIdx + 1 < allBars.length) {
          const execDate = allBars[signalIdx + 1].date

          // Standard buys every DCA interval
          const dayDate = new Date(day.date + 'T12:00:00Z')
          const periodKey = frequency === 'weekly'
            ? `${dayDate.getUTCFullYear()}-W${Math.ceil(dayDate.getUTCDate() / 7)}`
            : `${day.date.substring(0, 7)}`

          if (!stdPeriodKeys.has(periodKey)) {
            stdPeriodKeys.add(periodKey)
            stdExecutionDates.add(execDate)
          }

          // Enhanced only buys with positive multiplier
          if (day.finalMult > 0) {
            enhExecutionDates.add(execDate)
          }
        }
      })
    }

    // Calculate equity curves: track cumulative value at each bar for both strategies
    const equityCurves: Array<{ date: string; stdValue: number; enhValue: number; stdShares: number; enhShares: number }> = []
    let stdShares = 0, stdInvested = 0
    let enhShares = 0, enhInvested = 0

    for (const bar of allBars) {
      // Execute purchases at this bar's open
      if (stdExecutionDates.has(bar.date)) {
        const qty = dcaAmount / bar.open
        stdShares += qty
        stdInvested += dcaAmount
      }
      if (enhExecutionDates.has(bar.date)) {
        const qty = dcaAmount / bar.open
        enhShares += qty
        enhInvested += dcaAmount
      }

      equityCurves.push({
        date: bar.date,
        stdValue: stdShares * bar.close,
        enhValue: enhShares * bar.close,
        stdShares,
        enhShares,
      })
    }

    // 7. Calculate monthly stats for returns heatmap
    const monthlyStats: Record<string, { stdReturns: number; enhReturns: number; stdValue: number; enhValue: number }> = {}
    const monthStarts: Record<string, { stdValue: number; enhValue: number }> = {}

    for (const curve of equityCurves) {
      const monthKey = curve.date.substring(0, 7) // YYYY-MM

      // Track first bar of each month
      if (!monthStarts[monthKey]) {
        monthStarts[monthKey] = { stdValue: curve.stdValue, enhValue: curve.enhValue }
      }

      // Always update to latest value in month
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = { stdReturns: 0, enhReturns: 0, stdValue: 0, enhValue: 0 }
      }
      monthlyStats[monthKey].stdValue = curve.stdValue
      monthlyStats[monthKey].enhValue = curve.enhValue
    }

    // Calculate returns for each month
    for (const [monthKey, stats] of Object.entries(monthlyStats)) {
      const startValue = monthStarts[monthKey]
      if (startValue.stdValue > 0) {
        stats.stdReturns = ((stats.stdValue - startValue.stdValue) / startValue.stdValue) * 100
      }
      if (startValue.enhValue > 0) {
        stats.enhReturns = ((stats.enhValue - startValue.enhValue) / startValue.enhValue) * 100
      }
    }

    // Sort all arrays by date to ensure chart data is properly ordered
    const sortByDate = (a: any, b: any) => a.date.localeCompare(b.date)
    const sortedPrices = [...allBars].sort(sortByDate)
    const sortedEquityCurves = [...equityCurves].sort(sortByDate)

    // Calculate current price and 1-day change
    const latestPrice = sortedPrices.length > 0 ? sortedPrices[sortedPrices.length - 1].close : 0
    const previousPrice = sortedPrices.length > 1 ? sortedPrices[sortedPrices.length - 2].close : latestPrice
    const change1d = latestPrice - previousPrice
    const changePercent1d = previousPrice > 0 ? (change1d / previousPrice) * 100 : 0

    // 8. Return response
    return NextResponse.json({
      ticker,
      name: asset.name,
      sector: asset.sector,
      price: latestPrice,
      change1d,
      changePercent1d,
      params: { startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0], dcaAmount, frequency },
      tv: tvResult ? {
        signal: tvResult.signal,
        backtest: {
          ...tvResult.backtest,
          debugDCADays: tvResult.backtest.debugDCADays,
        },
      } : null,
      weekly: weeklyResult ? {
        signal: weeklyResult.signal,
        backtest: weeklyResult.backtest,
      } : null,
      monthly: monthlyResult ? {
        signal: monthlyResult.signal,
        backtest: monthlyResult.backtest,
      } : null,
      prices: sortedPrices,
      equityCurves: sortedEquityCurves,
      monthlyStats,
      buySignals: {
        std: Array.from(stdExecutionDates),
        enh: Array.from(enhExecutionDates),
      },
    })
  } catch (error) {
    console.error('Error in dashboard API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
