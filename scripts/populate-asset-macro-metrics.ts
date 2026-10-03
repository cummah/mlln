/**
 * populate-asset-macro-metrics.ts
 *
 * Populates asset_macro_metrics table for the asset/* folder
 * Merges data from:
 *  - asset_scores (conviction, macro regime, modifiers)
 *  - backtest_summary (DCA returns)
 *  - backtest_signals (weekly/monthly/daily signal data)
 *  - assets (ticker, sector)
 *
 * This is SEPARATE from the dashboard folder (Enhanced DCA model)
 * Allows comparing two different scoring models on the same assets
 *
 * Run with: npx ts-node --project tsconfig.scripts.json scripts/populate-asset-macro-metrics.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env.local
const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface AssetWithMetrics {
  id: number
  ticker: string
  sector: string | null
}

interface ConvictionData {
  fundamental_quality_score: number | null
  dca_suitability_score: number | null
  final_conviction_score: number | null
  factor_exposures: any
  macro_regime_state: string
  regime_weights: any
  staleness_penalty: number | null
  sector_modifier: number | null
}

interface BacktestData {
  stdReturn5y: number | null
  stdReturn3y: number | null
  stdReturn1y: number | null
  enhReturn5y: number | null
  enhReturn3y: number | null
  enhReturn1y: number | null
}

interface SignalCounts {
  weekly_buy_count: number
  monthly_buy_count: number
  daily_buy_count: number
  weekly_signal_strength: string
  monthly_signal_strength: string
  daily_signal_strength: string
  weekly_signal_amount: number
  monthly_signal_amount: number
  daily_signal_amount: number
}

// ─── Fetch Conviction Data ────────────────────────────────────────────────

async function getConvictionData(ticker: string): Promise<ConvictionData | null> {
  try {
    const { data, error } = await supabase
      .from('asset_scores')
      .select(
        'fundamental_quality_score, dca_suitability_score, final_conviction_score, factor_exposures, macro_regime_state, regime_weights, staleness_penalty, sector_modifier'
      )
      .eq('asset_id', (await getAssetId(ticker)) || 0)
      .single()

    if (error) {
      console.warn(`No conviction data for ${ticker}`)
      return null
    }

    return data as ConvictionData
  } catch (error) {
    console.error(`Error fetching conviction data for ${ticker}:`, error)
    return null
  }
}

// ─── Fetch Backtest Returns ───────────────────────────────────────────────

async function getBacktestReturns(ticker: string): Promise<BacktestData | null> {
  try {
    const { data, error } = await supabase
      .from('backtest_summary')
      .select('std_return_5y, std_return_3y, std_return_1y, enh_return_5y, enh_return_3y, enh_return_1y')
      .eq('ticker', ticker.toUpperCase())
      .single()

    if (error) {
      console.warn(`No backtest data for ${ticker}`)
      return null
    }

    return {
      stdReturn5y: data?.std_return_5y || null,
      stdReturn3y: data?.std_return_3y || null,
      stdReturn1y: data?.std_return_1y || null,
      enhReturn5y: data?.enh_return_5y || null,
      enhReturn3y: data?.enh_return_3y || null,
      enhReturn1y: data?.enh_return_1y || null,
    }
  } catch (error) {
    console.error(`Error fetching backtest data for ${ticker}:`, error)
    return null
  }
}

// ─── Fetch Macro Backtest Results ─────────────────────────────────────────

async function getMacroBacktestResults(ticker: string): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('asset_backtest_macro')
      .select('*')
      .eq('ticker', ticker.toUpperCase())
      .single()

    if (error || !data) {
      console.warn(`No macro backtest data for ${ticker}`)
      return null
    }

    return data
  } catch (error) {
    console.error(`Error fetching macro backtest for ${ticker}:`, error)
    return null
  }
}

// ─── Fetch Signal Data ─────────────────────────────────────────────────────

async function getSignalCounts(ticker: string): Promise<SignalCounts> {
  const defaults = {
    weekly_buy_count: 0,
    monthly_buy_count: 0,
    daily_buy_count: 0,
    weekly_signal_strength: 'neutral',
    monthly_signal_strength: 'neutral',
    daily_signal_strength: 'neutral',
    weekly_signal_amount: 0,
    monthly_signal_amount: 0,
    daily_signal_amount: 0,
  }

  try {
    const { data: signals, error } = await supabase
      .from('backtest_signals')
      .select('frequency, signal_type, signal_amount')
      .eq('ticker', ticker.toUpperCase())
      .order('created_at', { ascending: false })

    if (error || !signals) {
      return defaults
    }

    const counts: SignalCounts = { ...defaults }

    for (const signal of signals) {
      if (signal.frequency === 'weekly') {
        if (signal.signal_type === 'buy') counts.weekly_buy_count++
        if (!counts.weekly_signal_strength || counts.weekly_signal_strength === 'neutral') {
          counts.weekly_signal_strength = signal.signal_type
          counts.weekly_signal_amount = signal.signal_amount || 0
        }
      } else if (signal.frequency === 'monthly') {
        if (signal.signal_type === 'buy') counts.monthly_buy_count++
        if (!counts.monthly_signal_strength || counts.monthly_signal_strength === 'neutral') {
          counts.monthly_signal_strength = signal.signal_type
          counts.monthly_signal_amount = signal.signal_amount || 0
        }
      } else if (signal.frequency === 'daily') {
        if (signal.signal_type === 'buy') counts.daily_buy_count++
        if (!counts.daily_signal_strength || counts.daily_signal_strength === 'neutral') {
          counts.daily_signal_strength = signal.signal_type
          counts.daily_signal_amount = signal.signal_amount || 0
        }
      }
    }

    return counts
  } catch (error) {
    console.error(`Error fetching signal data for ${ticker}:`, error)
    return defaults
  }
}

// ─── Get Asset ID ─────────────────────────────────────────────────────────

async function getAssetId(ticker: string): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('assets')
      .select('id')
      .eq('ticker', ticker.toUpperCase())
      .single()

    return data?.id || null
  } catch {
    return null
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  try {
    console.log('Populating asset_macro_metrics table...')

    // Fetch all active assets
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('id, ticker, sector')
      .eq('is_active', true)

    if (assetsError || !assets) {
      throw new Error(`Failed to fetch assets: ${assetsError?.message}`)
    }

    console.log(`Found ${assets.length} active assets to process`)

    let processed = 0
    let failed = 0
    const rows: any[] = []

    for (const asset of assets) {
      try {
        const [convictionData, backtestData, macroBacktestData, signalData] = await Promise.all([
          getConvictionData(asset.ticker),
          getBacktestReturns(asset.ticker),
          getMacroBacktestResults(asset.ticker),
          getSignalCounts(asset.ticker),
        ])

        const row = {
          asset_id: asset.id,
          ticker: asset.ticker,
          sector: asset.sector,
          current_macro_regime: convictionData?.macro_regime_state || 'Goldilocks',
          macro_regime_updated_at: new Date().toISOString(),
          conviction_score_current: convictionData?.final_conviction_score || 50,
          dca_suitability_score: convictionData?.dca_suitability_score || 50,
          sector_modifier: convictionData?.sector_modifier || 1.0,
          fundamental_quality_score: convictionData?.fundamental_quality_score || null,
          factor_exposures: convictionData?.factor_exposures || null,
          regime_weights: convictionData?.regime_weights || null,
          staleness_penalty: convictionData?.staleness_penalty || null,
          weekly_signal_strength: signalData.weekly_signal_strength,
          weekly_signal_amount: signalData.weekly_signal_amount,
          weekly_signals_total_5y: signalData.weekly_buy_count,
          monthly_signal_strength: signalData.monthly_signal_strength,
          monthly_signal_amount: signalData.monthly_signal_amount,
          monthly_signals_total_5y: signalData.monthly_buy_count,
          daily_signal_strength: signalData.daily_signal_strength,
          daily_signal_amount: signalData.daily_signal_amount,
          daily_signals_total_5y: signalData.daily_buy_count,
          dca_return_5y: backtestData?.stdReturn5y || null,
          dca_return_3y: backtestData?.stdReturn3y || null,
          dca_return_1y: backtestData?.stdReturn1y || null,
          macro_return_5y: macroBacktestData?.macro_return_5y || null,
          macro_return_3y: macroBacktestData?.macro_return_3y || null,
          macro_return_1y: macroBacktestData?.macro_return_1y || null,
          macro_invested_5y: macroBacktestData?.macro_invested_5y || null,
          macro_invested_3y: macroBacktestData?.macro_invested_3y || null,
          macro_invested_1y: macroBacktestData?.macro_invested_1y || null,
          macro_buy_count_5y: macroBacktestData?.macro_buy_count_5y || null,
          macro_buy_count_3y: macroBacktestData?.macro_buy_count_3y || null,
          macro_buy_count_1y: macroBacktestData?.macro_buy_count_1y || null,
          alpha_vs_standard_5y: macroBacktestData?.alpha_vs_standard_5y || null,
          regime_distribution: macroBacktestData ? {
            goldilocks: macroBacktestData.regime_goldilocks_pct,
            overheating: macroBacktestData.regime_overheating_pct,
            stagflation: macroBacktestData.regime_stagflation_pct,
            deflation: macroBacktestData.regime_deflation_pct,
          } : null,
          metrics_computed_at: new Date().toISOString(),
          metrics_updated_at: new Date().toISOString(),
        }

        rows.push(row)
        processed++
      } catch (error) {
        console.error(`Error processing ${asset.ticker}:`, error)
        failed++
      }
    }

    // Bulk upsert
    if (rows.length > 0) {
      console.log(`\nUpserting ${rows.length} rows into asset_macro_metrics...`)
      const { error: upsertError } = await supabase
        .from('asset_macro_metrics')
        .upsert(rows, { onConflict: 'ticker' })

      if (upsertError) {
        console.error(`Upsert error: ${upsertError.message}`)
        failed += rows.length
      } else {
        console.log(`✓ Successfully upserted all rows`)
      }
    }

    console.log(`\n✓ Population complete: ${processed} processed, ${failed} failed`)
  } catch (error) {
    console.error('Error populating metrics:', error)
    process.exit(1)
  }
}

main()
