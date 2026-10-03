import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'

export async function GET(
  request: Request,
  { params }: { params: { ticker: string } }
) {
  try {
    const ticker = params.ticker.toUpperCase()

    // 1. Fetch asset by ticker
    const { data: assetData, error: assetError } = await getSupabaseClient()
      .from('assets')
      .select('id, ticker, name, sector, tags, fundamentals_last_updated')
      .eq('ticker', ticker)
      .eq('is_active', true)
      .single()

    if (assetError || !assetData) {
      return NextResponse.json(
        { error: 'Ticker not found or inactive' },
        { status: 404 }
      )
    }

    const asset = assetData as any;

    // 2. Fetch asset scores (app/asset isolation)
    const { data: scoreData, error: scoreError } = await getSupabaseClient()
      .from('asset_scores')
      .select(
        'fundamental_quality_score, dca_suitability_score, final_conviction_score, factor_exposures, macro_regime_state, regime_weights, staleness_penalty, computed_at'
      )
      .eq('asset_id', asset.id)
      .single()

    if (scoreError) {
      console.warn(`No scores found for ${ticker}:`, scoreError)
      // Return asset without scores if scores haven't been computed yet
      return NextResponse.json({
        ticker,
        name: asset.name,
        sector: asset.sector,
        tags: asset.tags || [],
        fundamentalsLastUpdated: asset.fundamentals_last_updated,
        scores: null,
        message: 'Scores not yet computed. Run compute-conviction-scores.ts',
      })
    }

    // 3. Fetch current macro regime for context
    const { data: macroData } = await getSupabaseClient()
      .from('macro_regime_current')
      .select('macro_score, regime_label, vix_level, yield_curve_spread, credit_spread')
      .limit(1)

    const macroRegime = (macroData as any)?.[0] || null

    // 4. Return combined response
    const scores = scoreData as any;
    return NextResponse.json({
      ticker,
      name: asset.name,
      sector: asset.sector,
      tags: asset.tags || [],
      fundamentalsLastUpdated: asset.fundamentals_last_updated,
      scores: {
        fundamentalQuality: scores.fundamental_quality_score,
        dcaSuitability: scores.dca_suitability_score,
        finalConviction: scores.final_conviction_score,
        factorExposures: scores.factor_exposures,
        macroRegimeState: scores.macro_regime_state,
        regimeWeights: scores.regime_weights,
        stalenessPenalty: scores.staleness_penalty,
        computedAt: scores.computed_at,
      },
      macroContext: macroRegime
        ? {
            score: macroRegime.macro_score,
            regime: macroRegime.regime_label,
            vix: macroRegime.vix_level,
            yieldCurveSpread: macroRegime.yield_curve_spread,
            creditSpread: macroRegime.credit_spread,
          }
        : null,
    })
  } catch (error) {
    console.error('Error fetching asset scores:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
