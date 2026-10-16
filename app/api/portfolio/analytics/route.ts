import { getSupabaseClient } from '@/lib/supabase'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

interface AnalyticsResponse {
  correlationMatrix: number[][]
  volatility: Record<string, number>
  portfolioMetrics: {
    expectedReturn: number
    volatility: number
    sharpeRatio: number
    maxDrawdown: number
  }
  assetMetrics: Array<{
    ticker: string
    return: number
    volatility: number
    sharpeRatio: number
    contribution: number
  }>
  efficientFrontier: Array<{
    volatility: number
    return: number
    sharpeRatio: number
  }>
  sectorComposition: Record<string, { allocation: number; tickers: string[] }>
  riskContribution: Record<string, number>
  /** Echoed so the UI can label the lookback instead of hardcoding it. */
  lookbackYears: number
  /** Tickers with no usable price history in the window. */
  missingTickers: string[]
  alignedObservations: number
  /**
   * First and last date actually used, not the date range requested. daily_prices
   * can lag well behind today, and the UI should say what it measured rather
   * than claim a clean N-year window.
   */
  windowStart: string | null
  windowEnd: string | null
}

const TRADING_DAYS = 252
const RISK_FREE_RATE = 0.05
const FRONTIER_SAMPLES = 60

const PAGE_SIZE = 1000

/**
 * Paginated per ticker.
 *
 * This previously issued one `.in('ticker', [...])` query with no range, and
 * PostgREST caps the response at 1000 rows for the *whole* result set. Three
 * tickers over a "5 year" window therefore returned ~333 rows each — Sept 2021
 * to Dec 2022 — so every correlation, volatility and return figure on the page
 * was computed from the 2022 drawdown regardless of the period selected. At 20
 * assets it would have been ~50 days each.
 *
 * One ticker per request keeps each series whole and lets them run in parallel.
 */
async function fetchTickerPrices(ticker: string, cutoff: string): Promise<Array<{ date: string; close: number }>> {
  const supabase = getSupabaseClient()
  const rows: Array<{ date: string; close: number }> = []

  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from('daily_prices')
      .select('date, close')
      .eq('ticker', ticker)
      .gte('date', cutoff)
      .order('date', { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (error) {
      console.error(`Error fetching prices for ${ticker}:`, error)
      break
    }
    const batch = (data ?? []) as Array<{ date: string; close: number | null }>
    for (const row of batch) {
      // Null and zero closes exist in daily_prices and would yield Infinity returns.
      if (row.close == null || !Number.isFinite(row.close) || row.close <= 0) continue
      rows.push({ date: row.date, close: row.close })
    }
    if (batch.length < PAGE_SIZE) break
    // Safety valve: 10 pages is 10k bars, far past any real listing history.
    if (page >= 9) break
  }

  return rows
}

async function fetchHistoricalPrices(
  tickers: string[],
  days: number
): Promise<Record<string, Array<{ date: string; close: number }>>> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)
  const cutoff = cutoffDate.toISOString().split('T')[0]

  const series = await Promise.all(tickers.map((ticker) => fetchTickerPrices(ticker, cutoff)))
  return Object.fromEntries(tickers.map((ticker, i) => [ticker, series[i]]))
}

/**
 * Correlation was previously computed by zipping each ticker's return array by
 * index. Tickers with different bar counts (holidays, listing gaps, missing
 * rows) therefore had their returns compared across different dates, which
 * silently invalidated the whole matrix. Align on the intersection of dates
 * first so every series describes the same days.
 */
function alignedReturns(
  priceData: Record<string, Array<{ date: string; close: number }>>,
  tickers: string[]
): { dates: string[]; returns: Record<string, number[]> } {
  const usable = tickers.filter((t) => (priceData[t]?.length ?? 0) >= 2)
  if (usable.length === 0) return { dates: [], returns: Object.fromEntries(tickers.map((t) => [t, []])) }

  // Count how many series each date appears in; a date present in all of them
  // is part of the intersection. Avoids Set spreading, which this tsconfig
  // target rejects.
  const dateCounts: Record<string, number> = {}
  for (const ticker of usable) {
    const seen: Record<string, true> = {}
    for (const point of priceData[ticker]) {
      if (seen[point.date]) continue
      seen[point.date] = true
      dateCounts[point.date] = (dateCounts[point.date] ?? 0) + 1
    }
  }
  const dates = Object.keys(dateCounts)
    .filter((d) => dateCounts[d] === usable.length)
    .sort()

  const returns: Record<string, number[]> = Object.fromEntries(tickers.map((t) => [t, []]))
  for (const ticker of usable) {
    const byDate = new Map(priceData[ticker].map((p) => [p.date, p.close]))
    const series: number[] = []
    for (let i = 1; i < dates.length; i++) {
      const prev = byDate.get(dates[i - 1])!
      const curr = byDate.get(dates[i])!
      series.push((curr - prev) / prev)
    }
    returns[ticker] = series
  }
  return { dates, returns }
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length
}

function calculateCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (n < 2) return 0
  const meanA = mean(a)
  const meanB = mean(b)
  let sumProduct = 0
  let sumSqA = 0
  let sumSqB = 0
  for (let i = 0; i < n; i++) {
    const dA = a[i] - meanA
    const dB = b[i] - meanB
    sumProduct += dA * dB
    sumSqA += dA * dA
    sumSqB += dB * dB
  }
  const denominator = Math.sqrt(sumSqA * sumSqB)
  if (denominator === 0) return 0
  // Clamp: floating point can push a perfect correlation just past ±1.
  return Math.max(-1, Math.min(1, sumProduct / denominator))
}

function calculateVolatility(returns: number[]): number {
  if (returns.length < 2) return 0
  const m = mean(returns)
  // Sample variance (n-1): the population divisor understated volatility.
  const variance = returns.reduce((sum, r) => sum + (r - m) ** 2, 0) / (returns.length - 1)
  return Math.sqrt(variance * TRADING_DAYS)
}

function calculateMeanReturn(returns: number[]): number {
  return mean(returns) * TRADING_DAYS
}

/**
 * Correct peak-to-trough drawdown. The previous implementation compared
 * `peak * (1 + ret)` against `peak` after already folding the return into the
 * peak, so it never measured a trough against a prior high.
 */
function calculateMaxDrawdown(returns: number[]): number {
  let value = 1
  let peak = 1
  let maxDD = 0
  for (const ret of returns) {
    value *= 1 + ret
    peak = Math.max(peak, value)
    maxDD = Math.min(maxDD, value / peak - 1)
  }
  return maxDD
}

/**
 * Deterministic PRNG (mulberry32). `Math.random()` meant every refetch — and
 * the analytics refetch fires on allocation changes — redrew a different cloud,
 * so the chart visibly jittered while the user was editing.
 */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedFrom(parts: string): number {
  let hash = 2166136261
  for (let i = 0; i < parts.length; i++) {
    hash ^= parts.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function portfolioVarianceOf(weights: number[], volatilities: number[], correlations: number[][]): number {
  let variance = 0
  for (let i = 0; i < weights.length; i++) {
    for (let j = 0; j < weights.length; j++) {
      variance += weights[i] * weights[j] * volatilities[i] * volatilities[j] * correlations[i][j]
    }
  }
  return Math.max(variance, 0)
}

function generateRiskReturnCloud(
  expectedReturns: number[],
  volatilities: number[],
  correlations: number[][],
  rng: () => number
): Array<{ volatility: number; return: number; sharpeRatio: number }> {
  const n = expectedReturns.length
  const cloud: Array<{ volatility: number; return: number; sharpeRatio: number }> = []

  for (let s = 0; s < FRONTIER_SAMPLES; s++) {
    let weights = Array.from({ length: n }, () => rng())
    const sum = weights.reduce((a, b) => a + b, 0)
    if (sum === 0) continue
    weights = weights.map((w) => w / sum)

    const portReturn = weights.reduce((acc, w, i) => acc + w * expectedReturns[i], 0)
    const portVolatility = Math.sqrt(portfolioVarianceOf(weights, volatilities, correlations))
    cloud.push({
      volatility: portVolatility,
      return: portReturn,
      sharpeRatio: portVolatility > 0 ? (portReturn - RISK_FREE_RATE) / portVolatility : 0,
    })
  }

  return cloud.sort((a, b) => a.volatility - b.volatility)
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tickersParam = searchParams.get('tickers')
    const allocationsParam = searchParams.get('allocations')
    const period = (searchParams.get('period') || '1y') as '1y' | '3y' | '5y'
    const sectorDataParam = searchParams.get('sectors')

    if (!tickersParam || !allocationsParam) {
      return Response.json({ error: 'Missing tickers or allocations' }, { status: 400 })
    }

    const tickers = Array.from(new Set(tickersParam.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean)))
    const rawAllocations = allocationsParam.split(',').map(Number)

    if (tickers.length === 0) {
      return Response.json({ error: 'No tickers supplied' }, { status: 400 })
    }
    if (rawAllocations.length !== tickers.length || rawAllocations.some((a) => !Number.isFinite(a))) {
      // The client zips these two lists positionally; a length mismatch would
      // silently map weights onto the wrong tickers.
      return Response.json({ error: 'tickers and allocations must be the same length' }, { status: 400 })
    }

    // searchParams.get() already percent-decodes; the extra decodeURIComponent
    // corrupted sector names containing a literal '%'.
    let sectorData: Record<string, string> = {}
    if (sectorDataParam) {
      try {
        sectorData = JSON.parse(sectorDataParam)
      } catch {
        sectorData = {}
      }
    }

    const lookbackYears = period === '5y' ? 5 : period === '3y' ? 3 : 1
    const days = lookbackYears * 365
    const priceData = await fetchHistoricalPrices(tickers, days)
    const { dates, returns: allReturns } = alignedReturns(priceData, tickers)
    const missingTickers = tickers.filter((t) => (allReturns[t]?.length ?? 0) < 2)

    const n = tickers.length
    const correlationMatrix: number[][] = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 1 : calculateCorrelation(allReturns[tickers[i]], allReturns[tickers[j]])))
    )

    const volatility: Record<string, number> = {}
    const expectedReturns: number[] = []
    const volatilities: number[] = []
    for (const ticker of tickers) {
      const vol = calculateVolatility(allReturns[ticker])
      volatility[ticker] = vol
      volatilities.push(vol)
      expectedReturns.push(calculateMeanReturn(allReturns[ticker]))
    }

    const weights = rawAllocations.map((a) => a / 100)
    const portfolioReturn = weights.reduce((acc, w, i) => acc + w * expectedReturns[i], 0)
    const portfolioVariance = portfolioVarianceOf(weights, volatilities, correlationMatrix)
    const portfolioVolatility = Math.sqrt(portfolioVariance)
    const portfolioSharpeRatio = portfolioVolatility > 0 ? (portfolioReturn - RISK_FREE_RATE) / portfolioVolatility : 0

    const observations = Math.max(dates.length - 1, 0)
    let maxDrawdown = 0
    if (observations > 0) {
      const portfolioReturns: number[] = []
      for (let i = 0; i < observations; i++) {
        let dayReturn = 0
        for (let j = 0; j < n; j++) dayReturn += weights[j] * (allReturns[tickers[j]][i] ?? 0)
        portfolioReturns.push(dayReturn)
      }
      maxDrawdown = calculateMaxDrawdown(portfolioReturns)
    }

    // Euler risk decomposition: w_i * (Σw)_i / σ_p, which sums to 1 across assets.
    const riskContribution: Record<string, number> = {}
    for (let i = 0; i < n; i++) {
      if (portfolioVolatility <= 0) {
        riskContribution[tickers[i]] = 0
        continue
      }
      const marginal =
        volatilities[i] * correlationMatrix[i].reduce((sum, c, j) => sum + c * weights[j] * volatilities[j], 0)
      riskContribution[tickers[i]] = (weights[i] * marginal) / portfolioVariance
    }

    const assetMetrics = tickers.map((ticker, idx) => ({
      ticker,
      return: expectedReturns[idx],
      volatility: volatilities[idx],
      sharpeRatio: volatilities[idx] > 0 ? (expectedReturns[idx] - RISK_FREE_RATE) / volatilities[idx] : 0,
      contribution: riskContribution[ticker],
    }))

    const rng = seededRandom(seedFrom(`${tickers.join(',')}|${rawAllocations.join(',')}|${period}`))
    const efficientFrontier = generateRiskReturnCloud(expectedReturns, volatilities, correlationMatrix, rng)

    const sectorComposition: Record<string, { allocation: number; tickers: string[] }> = {}
    for (let i = 0; i < n; i++) {
      const sector = sectorData[tickers[i]] || 'Other'
      if (!sectorComposition[sector]) sectorComposition[sector] = { allocation: 0, tickers: [] }
      sectorComposition[sector].allocation += rawAllocations[i]
      sectorComposition[sector].tickers.push(tickers[i])
    }

    const response: AnalyticsResponse = {
      correlationMatrix,
      volatility,
      portfolioMetrics: {
        expectedReturn: portfolioReturn,
        volatility: portfolioVolatility,
        sharpeRatio: portfolioSharpeRatio,
        maxDrawdown,
      },
      assetMetrics,
      efficientFrontier,
      sectorComposition,
      riskContribution,
      lookbackYears,
      missingTickers,
      alignedObservations: observations,
      windowStart: dates[0] ?? null,
      windowEnd: dates[dates.length - 1] ?? null,
    }

    return Response.json(response)
  } catch (error) {
    console.error('Analytics error:', error)
    return Response.json({ error: 'Failed to compute analytics' }, { status: 500 })
  }
}
