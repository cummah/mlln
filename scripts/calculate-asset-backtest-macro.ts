/**
 * calculate-asset-backtest-macro.ts
 *
 * Calculates backtest returns using Solution 2: Macro-Sector Sensitivity approach
 *
 * Algorithm:
 * 1. For each asset, get historical DCA signals
 * 2. For each signal date, look up the macro regime on that date
 * 3. Apply sector-regime modifier to the DCA investment amount
 * 4. Calculate final returns using modified investment amounts
 * 5. Store results in asset_backtest_macro table
 *
 * Formula: Modified Return = sum(DCA Amount × Sector-Regime Modifier)
 *
 * Run with: npx ts-node --project tsconfig.scripts.json scripts/calculate-asset-backtest-macro.ts
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

// ─── Types ────────────────────────────────────────────────────────────────

interface Signal {
  date: string
  amount: number
  mult: number // 0 = skip, 1 = buy
}

interface MacroRegimeSnapshot {
  snapshot_date: string
  regime_label: string
}

interface BacktestResult {
  return_5y: number
  invested_5y: number
  final_value_5y: number
  buy_count_5y: number
  skip_count_5y: number
  return_3y: number
  invested_3y: number
  final_value_3y: number
  buy_count_3y: number
  skip_count_3y: number
  return_1y: number
  invested_1y: number
  final_value_1y: number
  buy_count_1y: number
  skip_count_1y: number
  regime_distribution: {
    goldilocks_pct: number
    overheating_pct: number
    stagflation_pct: number
    deflation_pct: number
  }
}

// ─── Sector-Regime Modifiers (same as compute-conviction-scores.ts) ───────

function getSectorRegimeModifiers(): Record<string, Record<string, number>> {
  return {
    Goldilocks: {
      Technology: 1.15,
      'Communication Services': 1.10,
      'Consumer Discretionary': 1.05,
      Financials: 1.00,
      Industrials: 0.95,
      Materials: 0.95,
      Energy: 0.90,
      Utilities: 0.85,
      'Real Estate': 0.95,
      'Consumer Staples': 0.90,
      Healthcare: 1.00,
    },
    Overheating: {
      Technology: 0.90,
      'Communication Services': 0.95,
      'Consumer Discretionary': 0.85,
      Financials: 1.10,
      Industrials: 1.00,
      Materials: 1.05,
      Energy: 1.15,
      Utilities: 1.10,
      'Real Estate': 1.05,
      'Consumer Staples': 1.10,
      Healthcare: 1.05,
    },
    Stagflation: {
      Technology: 0.70,
      'Communication Services': 0.75,
      'Consumer Discretionary': 0.65,
      Financials: 0.80,
      Industrials: 0.85,
      Materials: 0.90,
      Energy: 1.30,
      Utilities: 1.15,
      'Real Estate': 0.80,
      'Consumer Staples': 1.05,
      Healthcare: 0.95,
    },
    Deflation: {
      Technology: 1.10,
      'Communication Services': 1.05,
      'Consumer Discretionary': 0.95,
      Financials: 0.85,
      Industrials: 0.95,
      Materials: 0.80,
      Energy: 0.75,
      Utilities: 1.05,
      'Real Estate': 1.15,
      'Consumer Staples': 1.10,
      Healthcare: 1.10,
    },
  }
}

function getSectorModifier(regime: string, sector: string | null): number {
  if (!sector) return 1.0
  const modifiers = getSectorRegimeModifiers()
  const regimeModifiers = modifiers[regime] || modifiers.Goldilocks
  return regimeModifiers[sector] || 1.0
}

// ─── Get Macro Regime for Date ────────────────────────────────────────────

async function getMacroRegimeOnDate(date: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('macro_regime_history')
      .select('regime_label')
      .lte('snapshot_date', date)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return 'Goldilocks' // Default
    return data.regime_label
  } catch {
    return 'Goldilocks'
  }
}

// ─── Get Historical Signals (from JSONB arrays) ───────────────────────────

async function getSignalsForAsset(ticker: string): Promise<Signal[]> {
  try {
    const { data, error } = await supabase
      .from('backtest_signals')
      .select('signals_5y_weekly, signals_3y_weekly, signals_1y_weekly, signals_5y_monthly, signals_3y_monthly, signals_1y_monthly, signals_5y_daily, signals_3y_daily, signals_1y_daily')
      .eq('ticker', ticker.toUpperCase())
      .single()

    if (error || !data) {
      console.warn(`No signal data found for ${ticker}`)
      return []
    }

    const allSignals: Signal[] = []
    const baseAmount = 100

    // Parse all JSONB signal arrays
    const signalFields = [
      'signals_5y_weekly',
      'signals_3y_weekly',
      'signals_1y_weekly',
      'signals_5y_monthly',
      'signals_3y_monthly',
      'signals_1y_monthly',
      'signals_5y_daily',
      'signals_3y_daily',
      'signals_1y_daily',
    ]

    for (const field of signalFields) {
      const signals = data[field as keyof typeof data]
      if (Array.isArray(signals)) {
        for (const sig of signals) {
          allSignals.push({
            date: sig.date,
            amount: baseAmount,
            mult: sig.isSkipped ? 0 : (sig.finalMult || 0),
          })
        }
      }
    }

    // Remove duplicates (same date from different timeframes)
    const uniqueSignals = Array.from(
      new Map(allSignals.map(s => [s.date, s])).values()
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    return uniqueSignals
  } catch (error) {
    console.error(`Error fetching signals for ${ticker}:`, error)
    return []
  }
}

// ─── Get Standard DCA Return (for comparison) ────────────────────────────

async function getStandardDCAReturn(ticker: string, window: '5y' | '3y' | '1y'): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('backtest_summary')
      .select('enh_return_5y, enh_return_3y, enh_return_1y')
      .eq('ticker', ticker.toUpperCase())
      .single()

    if (error || !data) return 0
    const fieldMap = {
      '5y': 'enh_return_5y',
      '3y': 'enh_return_3y',
      '1y': 'enh_return_1y',
    }
    return (data as any)[fieldMap[window]] || 0
  } catch {
    return 0
  }
}

// ─── Calculate Backtest Returns ────────────────────────────────────────────

async function calculateMacroBacktest(
  ticker: string,
  sector: string | null,
  signals: Signal[]
): Promise<BacktestResult> {
  const now = new Date()
  const cutoff5y = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate())
  const cutoff3y = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate())
  const cutoff1y = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())

  const baseAmount = 100 // $100 per buy signal

  const results = {
    return_5y: 0,
    invested_5y: 0,
    final_value_5y: 0,
    buy_count_5y: 0,
    skip_count_5y: 0,
    return_3y: 0,
    invested_3y: 0,
    final_value_3y: 0,
    buy_count_3y: 0,
    skip_count_3y: 0,
    return_1y: 0,
    invested_1y: 0,
    final_value_1y: 0,
    buy_count_1y: 0,
    skip_count_1y: 0,
    regime_distribution: {
      goldilocks_pct: 0,
      overheating_pct: 0,
      stagflation_pct: 0,
      deflation_pct: 0,
    },
  }

  const regimeCounts = {
    Goldilocks: 0,
    Overheating: 0,
    Stagflation: 0,
    Deflation: 0,
  }

  for (const signal of signals) {
    const signalDate = new Date(signal.date)
    const regime = await getMacroRegimeOnDate(signal.date)
    const modifier = getSectorModifier(regime, sector)

    // Apply modifier to investment amount
    // signal.mult is the multiplier (0 = skip, >0 = buy with that strength)
    const modifiedAmount = baseAmount * signal.mult * modifier
    const isBuy = signal.mult > 0

    // Count regime occurrences
    regimeCounts[regime as keyof typeof regimeCounts]++

    // 5-Year window
    if (signalDate >= cutoff5y) {
      results.invested_5y += modifiedAmount
      if (isBuy) {
        results.buy_count_5y++
      } else {
        results.skip_count_5y++
      }
    }

    // 3-Year window
    if (signalDate >= cutoff3y) {
      results.invested_3y += modifiedAmount
      if (isBuy) {
        results.buy_count_3y++
      } else {
        results.skip_count_3y++
      }
    }

    // 1-Year window
    if (signalDate >= cutoff1y) {
      results.invested_1y += modifiedAmount
      if (isBuy) {
        results.buy_count_1y++
      } else {
        results.skip_count_1y++
      }
    }
  }

  // Get standard DCA returns for comparison
  const stdReturn5y = await getStandardDCAReturn(ticker, '5y')
  const stdReturn3y = await getStandardDCAReturn(ticker, '3y')
  const stdReturn1y = await getStandardDCAReturn(ticker, '1y')

  // Calculate macro returns (assume same asset price performance, different dollar cost)
  // Simple approach: macro return = (invested amount / total amount) × average return
  if (results.invested_5y > 0) {
    results.final_value_5y = results.invested_5y * (1 + stdReturn5y / 100)
    results.return_5y = ((results.final_value_5y - results.invested_5y) / results.invested_5y) * 100
  }

  if (results.invested_3y > 0) {
    results.final_value_3y = results.invested_3y * (1 + stdReturn3y / 100)
    results.return_3y = ((results.final_value_3y - results.invested_3y) / results.invested_3y) * 100
  }

  if (results.invested_1y > 0) {
    results.final_value_1y = results.invested_1y * (1 + stdReturn1y / 100)
    results.return_1y = ((results.final_value_1y - results.invested_1y) / results.invested_1y) * 100
  }

  // Calculate regime distribution
  const totalSignals = Object.values(regimeCounts).reduce((a, b) => a + b, 0)
  if (totalSignals > 0) {
    results.regime_distribution.goldilocks_pct = (regimeCounts.Goldilocks / totalSignals) * 100
    results.regime_distribution.overheating_pct = (regimeCounts.Overheating / totalSignals) * 100
    results.regime_distribution.stagflation_pct = (regimeCounts.Stagflation / totalSignals) * 100
    results.regime_distribution.deflation_pct = (regimeCounts.Deflation / totalSignals) * 100
  }

  return results
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  try {
    console.log('Starting macro backtest calculation...')

    // Fetch all active assets
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('id, ticker, sector')
      .eq('is_active', true)

    if (assetsError || !assets) {
      throw new Error(`Failed to fetch assets: ${assetsError?.message}`)
    }

    console.log(`Found ${assets.length} assets to backtest`)

    let processed = 0
    let failed = 0
    const rows: any[] = []

    for (const asset of assets) {
      try {
        const signals = await getSignalsForAsset(asset.ticker)
        if (signals.length === 0) {
          console.warn(`No signals found for ${asset.ticker}`)
          continue
        }

        const backtest = await calculateMacroBacktest(asset.ticker, asset.sector, signals)
        const stdReturn5y = await getStandardDCAReturn(asset.ticker, '5y')

        const row = {
          asset_id: asset.id,
          ticker: asset.ticker,
          sector: asset.sector,
          macro_return_5y: Math.round(backtest.return_5y * 100) / 100,
          macro_invested_5y: Math.round(backtest.invested_5y * 100) / 100,
          macro_final_value_5y: Math.round(backtest.final_value_5y * 100) / 100,
          macro_buy_count_5y: backtest.buy_count_5y,
          macro_skip_count_5y: backtest.skip_count_5y,
          macro_return_3y: Math.round(backtest.return_3y * 100) / 100,
          macro_invested_3y: Math.round(backtest.invested_3y * 100) / 100,
          macro_final_value_3y: Math.round(backtest.final_value_3y * 100) / 100,
          macro_buy_count_3y: backtest.buy_count_3y,
          macro_skip_count_3y: backtest.skip_count_3y,
          macro_return_1y: Math.round(backtest.return_1y * 100) / 100,
          macro_invested_1y: Math.round(backtest.invested_1y * 100) / 100,
          macro_final_value_1y: Math.round(backtest.final_value_1y * 100) / 100,
          macro_buy_count_1y: backtest.buy_count_1y,
          macro_skip_count_1y: backtest.skip_count_1y,
          standard_dca_return_5y: stdReturn5y,
          alpha_vs_standard_5y: Math.round((backtest.return_5y - stdReturn5y) * 100) / 100,
          regime_goldilocks_pct: Math.round(backtest.regime_distribution.goldilocks_pct * 100) / 100,
          regime_overheating_pct: Math.round(backtest.regime_distribution.overheating_pct * 100) / 100,
          regime_stagflation_pct: Math.round(backtest.regime_distribution.stagflation_pct * 100) / 100,
          regime_deflation_pct: Math.round(backtest.regime_distribution.deflation_pct * 100) / 100,
          calculated_at: new Date().toISOString(),
        }

        rows.push(row)
        processed++

        if (processed % 50 === 0) {
          console.log(`Processed ${processed} assets...`)
        }
      } catch (error) {
        console.error(`Error processing ${asset.ticker}:`, error)
        failed++
      }
    }

    // Bulk upsert
    if (rows.length > 0) {
      console.log(`\nUpserting ${rows.length} backtest results...`)
      const { error: upsertError } = await supabase
        .from('asset_backtest_macro')
        .upsert(rows, { onConflict: 'ticker' })

      if (upsertError) {
        console.error(`Upsert error: ${upsertError.message}`)
      } else {
        console.log(`✓ Successfully upserted all backtest results`)
      }
    }

    console.log(`\n✓ Backtest calculation complete: ${processed} processed, ${failed} failed`)
  } catch (error) {
    console.error('Error in backtest calculation:', error)
    process.exit(1)
  }
}

main()
