import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'
import { runTVEnhancedDCA, PriceBar } from '@/lib/dcaEngine'

export async function GET(
  request: Request,
  { params }: { params: { ticker: string } }
) {
  try {
    const ticker = params.ticker.toUpperCase()

    // Parse window query parameter (1y, 3y, 5y)
    const url = new URL(request.url)
    const windowParam = (url.searchParams.get('window') || '5y').toLowerCase()

    const yearsBack: Record<string, number> = { '1y': 1, '3y': 3, '5y': 5 }
    const years = yearsBack[windowParam] ?? 5
    const display = windowParam as '1y' | '3y' | '5y'

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

    // 2. Fetch all price bars (paginate to handle >1000 rows)
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

    const prices = allPrices

    if (!prices || prices.length === 0) {
      return NextResponse.json(
        { error: 'No price data found for ticker' },
        { status: 404 }
      )
    }

    console.log(`[${ticker}] Query returned ${prices.length} rows (paginated, ${Math.ceil(prices.length / pageSize)} pages)`)

    // Fetch VIX data for signal weighting
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

    // Convert to PriceBar format (include VIX)
    const allBars: PriceBar[] = prices.map(p => ({
      date: p.date,
      open: Number(p.open),
      high: Number(p.high),
      low: Number(p.low),
      close: Number(p.close),
      volume: Number(p.volume),
      vix: vixMap.get(p.date),
    }))

    console.log(`[${ticker}] Fetched ${allBars.length} bars, date range: ${allBars[0].date} to ${allBars[allBars.length - 1].date}`)

    // 4. Slice bars by calendar date (not bar count)
    const lastDate = new Date(allBars[allBars.length - 1].date)
    const cutoffDate = new Date(lastDate)
    cutoffDate.setFullYear(cutoffDate.getFullYear() - years)
    const cutoffStr = cutoffDate.toISOString().slice(0, 10)

    const cutoffIndex = allBars.findIndex(b => b.date >= cutoffStr)
    const warmupStart = Math.max(0, cutoffIndex - 250)
    const windowBars = allBars.slice(warmupStart)

    console.log(`[${ticker}] Window ${display}: cutoff date ${cutoffStr}, warmup from index ${warmupStart}, sliced to ${windowBars.length} bars, range: ${windowBars[0].date} to ${windowBars[windowBars.length - 1].date}`)
    console.log(`[${ticker}] Window ${display}: LAST 5 DATES IN RESULT: ${windowBars.slice(-5).map(b => b.date).join(', ')}`)

    // 5. Run DCA on sliced bars (twice for weekly and monthly)
    let weeklyResult: any = null
    let monthlyResult: any = null

    try {
      weeklyResult = runTVEnhancedDCA(windowBars, { rsiLength: 7, baseAmount: 100, frequency: 'weekly', useVIX: true })
    } catch (err) {
      console.error(`[${ticker}] Error running weekly DCA:`, err)
    }

    try {
      monthlyResult = runTVEnhancedDCA(windowBars, { rsiLength: 14, baseAmount: 433, frequency: 'monthly', useVIX: true })
    } catch (err) {
      console.error(`[${ticker}] Error running monthly DCA:`, err)
    }

    // TV-matched enhanced DCA: all PineScript defaults + VIX enabled
    let tvResult: any = null
    try {
      // Note: TV enhanced DCA doesn't have fromDate parameter yet, but we use the warmup bars
      // to seed indicators. The calculated totalWeeks will be correct based on the actual date range.
      tvResult = runTVEnhancedDCA(windowBars, {
        baseAmount: 100,
        frequency: 'weekly',
        slippage: 0.05,
        rsiLength: 7,
        rsiLevel1: 35,
        rsiLevel2: 45,
        rsiLevel3: 50,
        rsiLevel4: 55,
        buyPercent1: 400,
        buyPercent2: 150,
        buyPercent3: 50,
        buyPercent4: 0,
        buyPercent5: 0,
        adxPeriod: 14,
        adxThreshold: 25,
        trendPenalty: 0.5,
        onlyPenalizeDowntrends: true,
        drawdownAggression: 2.0,
        maxDrawdownBonus: 2.0,
        drawdownLookback: 252,
        extremeDrawdownOverride: true,
        extremeDrawdownThreshold: 20,
        emaLength: 200,
        emaMaxPct: 15.0,
        emaBelowMaxMult: 2.0,
        emaAboveMinMult: 0.0,
        useVIX: true, // Only difference from PineScript defaults
        vixThreshold: 25,
        vixBonusMultiplier: 1.5,
        vixRSICombo: true,
        maxTotalMultiplier: 6.0,
      })
    } catch (err) {
      console.error(`[${ticker}] Error running TV enhanced DCA:`, err)
    }

    // Calculate actual purchase counts
    let stdPurchaseCount = 0
    let enhPurchaseCount = 0

    // Standard DCA purchase count comes from weeklyResult.backtest.totalWeeks
    if (weeklyResult?.backtest?.totalWeeks !== undefined) {
      stdPurchaseCount = weeklyResult.backtest.totalWeeks
    }

    // Enhanced DCA purchase count: count dates where finalMult > 0 from TV backtest debugDCADays
    if (tvResult?.backtest?.debugDCADays) {
      tvResult.backtest.debugDCADays.forEach((day: any) => {
        if (day.finalMult > 0) {
          enhPurchaseCount++
        }
      })
    }

    // 6. Return response
    return NextResponse.json({
      ticker,
      name: asset.name,
      sector: asset.sector,
      window: display,
      prices: windowBars.map(b => ({
        date: b.date,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      })),
      tv: tvResult ? {
        signal: tvResult.signal,
        backtest: tvResult.backtest,
        purchaseCounts: {
          std: stdPurchaseCount,
          enh: enhPurchaseCount,
        },
      } : null,
      weekly: {
        signal: weeklyResult?.signal || null,
        backtest: weeklyResult?.backtest || null,
      },
      monthly: {
        signal: monthlyResult?.signal || null,
        backtest: monthlyResult?.backtest || null,
      },
    })
  } catch (error) {
    console.error('Error in signal API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
