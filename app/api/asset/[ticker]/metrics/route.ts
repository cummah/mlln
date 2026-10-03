/**
 * GET /api/asset/[ticker]/metrics
 *
 * Returns macro-aware metrics for the asset folder (Solution 2)
 * Uses asset_macro_metrics table
 *
 * SEPARATE from /api/dashboard/* (which uses Enhanced DCA model)
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

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

    // Fetch asset details - this is what actually gates whether the ticker exists
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('id, name, sector, asset_type')
      .eq('ticker', ticker)
      .single()

    if (assetError || !asset) {
      return NextResponse.json(
        { error: `No asset found for ${ticker}` },
        { status: 404 }
      )
    }

    // Macro metrics (Solution 2) - may not exist yet (backfill pipeline hasn't reached every
    // ticker), so treat as optional rather than 404ing the whole page over it
    const { data: metrics } = await supabase
      .from('asset_macro_metrics')
      .select('*')
      .eq('ticker', ticker)
      .maybeSingle()

    // Fetch data quality info from backtest_signals
    const { data: backtest } = await supabase
      .from('backtest_signals')
      .select('is_new_asset, data_quality_score, warning_message')
      .eq('ticker', ticker)
      .single()

    return NextResponse.json({
      ticker,
      name: asset?.name || ticker,
      sector: asset?.sector || metrics?.sector,
      assetType: asset?.asset_type || 'stock',
      price: 0,
      change1d: 0,
      changePercent1d: 0,

      // Macro metrics (Solution 2)
      macroRegime: metrics?.current_macro_regime,
      convictionScore: metrics?.conviction_score_current,
      dcaScore: metrics?.dca_suitability_score,
      sectorModifier: metrics?.sector_modifier,
      fundamentalScore: metrics?.fundamental_quality_score,
      stalenessPenalty: metrics?.staleness_penalty,

      // Signals
      weeklySignal: {
        strength: metrics?.weekly_signal_strength,
        amount: metrics?.weekly_signal_amount,
        totalBuys5y: metrics?.weekly_signals_total_5y,
      },
      monthlySignal: {
        strength: metrics?.monthly_signal_strength,
        amount: metrics?.monthly_signal_amount,
        totalBuys5y: metrics?.monthly_signals_total_5y,
      },
      dailySignal: {
        strength: metrics?.daily_signal_strength,
        amount: metrics?.daily_signal_amount,
        totalBuys5y: metrics?.daily_signals_total_5y,
      },

      // Performance (reference)
      returns: {
        return5y: metrics?.dca_return_5y,
        return3y: metrics?.dca_return_3y,
        return1y: metrics?.dca_return_1y,
      },

      // Macro performance
      macro_return_5y: metrics?.macro_return_5y,
      macro_return_3y: metrics?.macro_return_3y,
      macro_return_1y: metrics?.macro_return_1y,
      macro_invested_5y: metrics?.macro_invested_5y,
      macro_invested_3y: metrics?.macro_invested_3y,
      macro_invested_1y: metrics?.macro_invested_1y,
      macro_buy_count_5y: metrics?.macro_buy_count_5y,
      macro_buy_count_3y: metrics?.macro_buy_count_3y,
      macro_buy_count_1y: metrics?.macro_buy_count_1y,
      alpha_vs_standard_5y: metrics?.alpha_vs_standard_5y,

      // Data quality (for new/limited-history assets)
      isNewAsset: backtest?.is_new_asset || false,
      dataQualityScore: backtest?.data_quality_score || 100,
      warningMessage: backtest?.warning_message || null,

      // Freshness
      computedAt: metrics?.metrics_computed_at,
      updatedAt: metrics?.metrics_updated_at,
    })
  } catch (error) {
    console.error(`Error fetching asset metrics for ${params.ticker}:`, error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}
