import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    // 1. Fetch current macro regime
    const { data: macroData, error: macroError } = await getSupabaseClient()
      .from('macro_regime_current')
      .select(
        'macro_score, regime_label, vix_level, yield_curve_spread, credit_spread, us_initial_claims, global_trade_signal, composite_signal, updated_at'
      )
      .limit(1)

    if (macroError || !macroData || macroData.length === 0) {
      return NextResponse.json(
        { error: 'No macro regime data available' },
        { status: 404 }
      )
    }

    const current = (macroData[0]) as any

    // 2. Fetch regime weights for current state
    const { data: weightsData } = await getSupabaseClient()
      .from('macro_regime_weights')
      .select('weight_quality, weight_value, weight_growth, weight_momentum')
      .eq('regime_state', current.regime_label)
      .single()

    const weights = (weightsData || null) as any

    // 3. Fetch recent history (last 20 records for trend visualization)
    const { data: historyData } = await getSupabaseClient()
      .from('macro_regime_history')
      .select(
        'snapshot_date, regime_label, macro_score, vix_level, yield_curve_spread, credit_spread'
      )
      .order('snapshot_date', { ascending: false })
      .limit(20)

    // 4. Return response
    return NextResponse.json({
      current: {
        macroScore: current.macro_score,
        regimeLabel: current.regime_label,
        vixLevel: current.vix_level,
        yieldCurveSpread: current.yield_curve_spread,
        creditSpread: current.credit_spread,
        usInitialClaims: current.us_initial_claims,
        globalTradeSignal: current.global_trade_signal,
        compositeSignal: current.composite_signal,
        updatedAt: current.updated_at,
      },
      weights: weights
        ? {
            quality: weights.weight_quality,
            value: weights.weight_value,
            growth: weights.weight_growth,
            momentum: weights.weight_momentum,
          }
        : null,
      history: historyData
        ? historyData.map((h: any) => ({
            date: h.snapshot_date,
            regime: h.regime_label,
            macroScore: h.macro_score,
            vix: h.vix_level,
            yieldCurveSpread: h.yield_curve_spread,
            creditSpread: h.credit_spread,
          }))
        : [],
    })
  } catch (error) {
    console.error('Error fetching macro regime:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
