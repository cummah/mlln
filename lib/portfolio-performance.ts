import { getSupabaseClient } from '@/lib/supabase'

interface MonthlyPerformance {
  date: string
  stdReturn: number
  enhReturn: number
}

export async function getPortfolioMonthlyPerformance(
  tickers: string[],
  allocations: Record<string, number>,
  monthlyAmount: number
): Promise<MonthlyPerformance[]> {
  const db = getSupabaseClient()
  
  // Get 5 years of daily prices
  const fiveYearsAgo = new Date()
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)
  const startDate = fiveYearsAgo.toISOString().split('T')[0]
  
  // Fetch daily prices
  const { data: prices, error } = await db
    .from('daily_prices')
    .select('ticker, date, close')
    .in('ticker', tickers)
    .gte('date', startDate)
    .order('date')
  
  if (error) throw new Error(`Failed to fetch prices: ${error.message}`)
  
  // Group prices by month
  const pricesByMonth = new Map<string, Record<string, number>>()
  
  for (const p of (prices as any[]) || []) {
    const month = p.date.slice(0, 7)
    if (!pricesByMonth.has(month)) {
      pricesByMonth.set(month, {})
    }
    pricesByMonth.get(month)![p.ticker] = Number(p.close)
  }
  
  const months = Array.from(pricesByMonth.keys()).sort()
  
  // Calculate monthly returns
  const result: MonthlyPerformance[] = []
  let stdDcaValue = 0
  let enhDcaValue = 0
  let prevPrices: Record<string, number> = {}
  
  for (const month of months) {
    const monthPrices = pricesByMonth.get(month)!
    
    // Standard DCA: equal contribution each month
    let stdValue = 0
    for (const ticker of tickers) {
      const price = monthPrices[ticker]
      if (price && prevPrices[ticker]) {
        const shares = monthlyAmount * (allocations[ticker] / 100) / price
        const prevValue = shares * prevPrices[ticker]
        stdValue += monthlyAmount * (allocations[ticker] / 100)
      }
    }
    
    // Enhanced DCA: same for now (would use signals in production)
    let enhValue = 0
    for (const ticker of tickers) {
      const price = monthPrices[ticker]
      if (price && prevPrices[ticker]) {
        const shares = monthlyAmount * (allocations[ticker] / 100) / price
        const prevValue = shares * prevPrices[ticker]
        enhValue += monthlyAmount * (allocations[ticker] / 100)
      }
    }
    
    stdDcaValue += stdValue
    enhDcaValue += enhValue
    
    const stdReturn = stdDcaValue > 0 ? ((stdDcaValue - (months.length * monthlyAmount)) / (months.length * monthlyAmount)) * 100 : 0
    const enhReturn = enhDcaValue > 0 ? ((enhDcaValue - (months.length * monthlyAmount)) / (months.length * monthlyAmount)) * 100 : 0
    
    result.push({
      date: month,
      stdReturn,
      enhReturn
    })
    
    prevPrices = monthPrices
  }
  
  return result
}
