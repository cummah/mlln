/**
 * GET /api/asset/[ticker]/macro-backtest?factor=1&vol=1&meanReversion=1
 *
 * Live recomputation of the Macro model's DCA backtest with the Factor Tilt (PCA),
 * Volatility Timing (EWMA), and Mean Reversion (AR(1)/OU) components independently
 * toggleable. Reads the raw per-buy components from macro_signal_components (written by
 * scripts/compute-macro-backtest.ts) and recombines them via lib/macroBacktestEngine.ts -
 * the same function the batch script uses to populate backtest_summary_macro, so
 * factor=1&vol=1&meanReversion=1 always matches that table.
 *
 * Response is a flat, camelCase partial BacktestSummary (lib/backtest-summary.ts) - the
 * client spreads it directly over the statically-fetched macroSummary with no mapping.
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { buildBacktestResults, buildBacktestSummaryFields } from '@/lib/macroBacktestEngine'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  try {
    const ticker = params.ticker.toUpperCase()
    const { searchParams } = new URL(request.url)
    const factor = searchParams.get('factor') !== '0'
    const vol = searchParams.get('vol') !== '0'
    const meanReversion = searchParams.get('meanReversion') !== '0'

    const { data, error } = await supabase
      .from('macro_signal_components')
      .select('weekly_buys, monthly_buys, latest_close')
      .eq('ticker', ticker)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: `No macro signal components for ${ticker}` }, { status: 404 })
    }

    const results = buildBacktestResults(data.weekly_buys, data.monthly_buys, data.latest_close, { factor, vol, meanReversion })
    const fields = buildBacktestSummaryFields(results)

    return NextResponse.json(fields)
  } catch (error) {
    console.error(`Error computing live macro backtest for ${params.ticker}:`, error)
    return NextResponse.json({ error: 'Failed to compute macro backtest' }, { status: 500 })
  }
}
