import { NextRequest, NextResponse } from 'next/server'
import { getBacktestSummary } from '@/lib/backtest-summary'

const MAX_TICKERS = 20

// GET /api/portfolio/summaries?tickers=AAPL,NVDA,SPY
// Bulk-fetches BacktestSummary rows for the portfolio builder. Reuses
// getBacktestSummary (lib/backtest-summary.ts) per ticker rather than
// re-implementing its row mapping/staleness/fallback logic.
export async function GET(request: NextRequest) {
  const tickersParam = request.nextUrl.searchParams.get('tickers') || ''
  const tickers = Array.from(
    new Set(
      tickersParam
        .split(',')
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean)
    )
  ).slice(0, MAX_TICKERS)

  if (tickers.length === 0) {
    return NextResponse.json([])
  }

  const summaries = await Promise.all(tickers.map((ticker) => getBacktestSummary(ticker)))
  return NextResponse.json(summaries.filter((s) => s !== null))
}
