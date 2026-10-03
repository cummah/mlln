import { getSupabaseClient } from './supabase'
import { runTVEnhancedDCA, type PriceBar, type TVSignal } from './dcaEngine'

export interface SignalRow {
  ticker: string
  weekly_date: string | null
  weekly_rsi: number | null
  weekly_rsi_multiplier: number | null
  weekly_ema_distance_pct: number | null
  weekly_ema_multiplier: number | null
  weekly_adx: number | null
  weekly_plus_di: number | null
  weekly_minus_di: number | null
  weekly_regime: string | null
  weekly_regime_multiplier: number | null
  weekly_drawdown_pct: number | null
  weekly_drawdown_multiplier: number | null
  weekly_vix: number | null
  weekly_vix_multiplier: number | null
  weekly_final_multiplier: number | null
  weekly_base_amount: number | null
  weekly_final_amount: number | null
  weekly_is_capped: boolean | null
  monthly_date: string | null
  monthly_rsi: number | null
  monthly_rsi_multiplier: number | null
  monthly_ema_distance_pct: number | null
  monthly_ema_multiplier: number | null
  monthly_adx: number | null
  monthly_plus_di: number | null
  monthly_minus_di: number | null
  monthly_regime: string | null
  monthly_regime_multiplier: number | null
  monthly_drawdown_pct: number | null
  monthly_drawdown_multiplier: number | null
  monthly_vix: number | null
  monthly_vix_multiplier: number | null
  monthly_final_multiplier: number | null
  monthly_base_amount: number | null
  monthly_final_amount: number | null
  monthly_is_capped: boolean | null
}

export interface SignalHistoryRow {
  ticker: string
  frequency: 'weekly' | 'monthly'
  signal_date: string
  rank: number
  rsi: number
  rsi_multiplier: number
  ema_distance_pct: number
  ema_multiplier: number
  adx: number
  plus_di: number
  minus_di: number
  regime: string
  regime_multiplier: number
  drawdown_pct: number
  drawdown_multiplier: number
  vix: number | null
  vix_multiplier: number
  final_multiplier: number
  base_amount: number
  final_amount: number
  is_capped: boolean
}

function tvSignalToRow(signal: TVSignal, prefix: string): Record<string, any> {
  return {
    [`${prefix}_date`]: signal.date,
    [`${prefix}_rsi`]: signal.rsi,
    [`${prefix}_rsi_multiplier`]: signal.rsiMultiplier,
    [`${prefix}_ema_distance_pct`]: signal.emaDistancePct,
    [`${prefix}_ema_multiplier`]: signal.emaMultiplier,
    [`${prefix}_adx`]: signal.adx,
    [`${prefix}_plus_di`]: signal.plusDI,
    [`${prefix}_minus_di`]: signal.minusDI,
    [`${prefix}_regime`]: signal.regime,
    [`${prefix}_regime_multiplier`]: signal.regimeMultiplier,
    [`${prefix}_drawdown_pct`]: signal.drawdownPct,
    [`${prefix}_drawdown_multiplier`]: signal.drawdownMultiplier,
    [`${prefix}_vix`]: signal.vix,
    [`${prefix}_vix_multiplier`]: signal.vixMultiplier,
    [`${prefix}_final_multiplier`]: signal.finalMultiplier,
    [`${prefix}_base_amount`]: signal.baseAmount,
    [`${prefix}_final_amount`]: signal.finalAmount,
    [`${prefix}_is_capped`]: signal.isCapped,
  }
}

export async function calculateAndStoreSignals(ticker: string): Promise<void> {
  const supabase = getSupabaseClient()

  // Fetch daily prices for this ticker
  const { data: pricesData, error: pricesError } = await supabase
    .from('daily_prices')
    .select('date, open, high, low, close, volume')
    .eq('ticker', ticker.toUpperCase())
    .order('date', { ascending: true })

  if (pricesError || !pricesData || pricesData.length === 0) {
    throw new Error(`No price data found for ${ticker}`)
  }

  // Convert to PriceBar format
  const bars: PriceBar[] = pricesData.map((p: any) => ({
    date: p.date,
    open: Number(p.open),
    high: Number(p.high),
    low: Number(p.low),
    close: Number(p.close),
    volume: Number(p.volume),
  }))

  // Run enhanced DCA for weekly (RSI 7) and monthly (RSI 14)
  const weeklyResult = runTVEnhancedDCA(bars, {
    baseAmount: 100,
    frequency: 'weekly',
    rsiLength: 7,
  })

  const monthlyResult = runTVEnhancedDCA(bars, {
    baseAmount: 100,
    frequency: 'monthly',
    rsiLength: 14,
  })

  // Prepare current signal row
  const signalRow: Partial<SignalRow> = {
    ticker: ticker.toUpperCase(),
    ...tvSignalToRow(weeklyResult.signal, 'weekly'),
    ...tvSignalToRow(monthlyResult.signal, 'monthly'),
  }

  // Delete existing and insert new (simpler than upsert to avoid schema cache issues)
  await supabase.from('signals').delete().eq('ticker', ticker.toUpperCase())
  const { error: insertError } = await supabase.from('signals').insert([signalRow] as any)
  if (insertError) {
    throw new Error(`Failed to insert signals: ${insertError.message}`)
  }

  // Extract and store top recent buy opportunities from backtest history
  // Get top 10 buys (sorted by finalMultiplier desc) from debugDCADays
  const topWeeklyBuys = (weeklyResult.backtest.debugDCADays || [])
    .filter((d: any) => d.finalMult > 0)
    .sort((a: any, b: any) => b.finalMult - a.finalMult)
    .slice(0, 10)
    .map((d: any, index: number) => ({
      ticker: ticker.toUpperCase(),
      frequency: 'weekly' as const,
      signal_date: d.date,
      rank: index + 1,
      rsi: d.rsi,
      rsi_multiplier: d.rsiMult,
      ema_distance_pct: d.emaDistancePct,
      ema_multiplier: d.emaMult,
      adx: d.adx,
      plus_di: d.plusDI,
      minus_di: d.minusDI,
      regime: d.regime || 'ranging',
      regime_multiplier: d.regimeAdj,
      drawdown_pct: d.drawdownPct,
      drawdown_multiplier: d.ddBonus,
      vix: d.vix || null,
      vix_multiplier: d.vixBonus || 1,
      final_multiplier: d.finalMult,
      base_amount: 100,
      final_amount: 100 * d.finalMult,
      is_capped: d.isCapped || false,
    }))

  const topMonthlyBuys = (monthlyResult.backtest.debugDCADays || [])
    .filter((d: any) => d.finalMult > 0)
    .sort((a: any, b: any) => b.finalMult - a.finalMult)
    .slice(0, 10)
    .map((d: any, index: number) => ({
      ticker: ticker.toUpperCase(),
      frequency: 'monthly' as const,
      signal_date: d.date,
      rank: index + 1,
      rsi: d.rsi,
      rsi_multiplier: d.rsiMult,
      ema_distance_pct: d.emaDistancePct,
      ema_multiplier: d.emaMult,
      adx: d.adx,
      plus_di: d.plusDI,
      minus_di: d.minusDI,
      regime: d.regime || 'ranging',
      regime_multiplier: d.regimeAdj,
      drawdown_pct: d.drawdownPct,
      drawdown_multiplier: d.ddBonus,
      vix: d.vix || null,
      vix_multiplier: d.vixBonus || 1,
      final_multiplier: d.finalMult,
      base_amount: 100,
      final_amount: 100 * d.finalMult,
      is_capped: d.isCapped || false,
    }))

  const allHistoryRows = [...topWeeklyBuys, ...topMonthlyBuys]

  // Clear old history for this ticker and insert new
  if (allHistoryRows.length > 0) {
    // Delete existing history for this ticker
    await supabase
      .from('signal_history')
      .delete()
      .eq('ticker', ticker.toUpperCase())

    // Insert new history
    const { error: historyError } = await supabase
      .from('signal_history')
      .insert(allHistoryRows as any)

    if (historyError) {
      throw new Error(`Failed to insert signal history: ${historyError.message}`)
    }
  }
}

export async function getSignal(ticker: string): Promise<SignalRow | null> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('signals')
    .select('*')
    .eq('ticker', ticker.toUpperCase())
    .single()

  if (error) {
    console.error(`Error fetching signal for ${ticker}:`, error)
    return null
  }

  return data
}

export async function getSignalHistory(
  ticker: string,
  frequency?: 'weekly' | 'monthly'
): Promise<SignalHistoryRow[]> {
  const supabase = getSupabaseClient()

  let query = supabase
    .from('signal_history')
    .select('*')
    .eq('ticker', ticker.toUpperCase())

  if (frequency) {
    query = query.eq('frequency', frequency)
  }

  const { data, error } = await query.order('rank', { ascending: true })

  if (error) {
    console.error(`Error fetching signal history for ${ticker}:`, error)
    return []
  }

  return data || []
}
