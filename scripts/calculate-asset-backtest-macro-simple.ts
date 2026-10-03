/**
 * calculate-asset-backtest-macro-simple.ts
 *
 * Simplified approach: Use existing backtest invested amounts + macro-sector modifiers
 * to estimate macro backtest returns
 *
 * Formula: Macro Return = Base Return × (1 + Regime Impact)
 * Where Regime Impact varies by sector-regime combination
 *
 * This avoids needing to parse all historical signals while still incorporating
 * sector-regime sensitivity into the performance estimate
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

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

// Sector-Regime sensitivity factors (impact on return)
function getSectorRegimeImpact(): Record<string, Record<string, number>> {
  return {
    Goldilocks: {
      Technology: 0.12,        // Tech outperforms by 12%
      'Communication Services': 0.08,
      'Consumer Discretionary': 0.05,
      Financials: 0.00,
      Industrials: -0.02,
      Materials: -0.02,
      Energy: -0.10,
      Utilities: -0.15,
      'Real Estate': -0.03,
      'Consumer Staples': -0.08,
      Healthcare: 0.00,
    },
    Overheating: {
      Technology: -0.15,       // Tech underperforms
      'Communication Services': -0.08,
      'Consumer Discretionary': -0.20,
      Financials: 0.08,
      Industrials: 0.00,
      Materials: 0.05,
      Energy: 0.15,           // Energy outperforms
      Utilities: 0.10,
      'Real Estate': 0.05,
      'Consumer Staples': 0.08,
      Healthcare: 0.03,
    },
    Stagflation: {
      Technology: -0.35,      // Tech crashes
      'Communication Services': -0.25,
      'Consumer Discretionary': -0.40,
      Financials: -0.15,
      Industrials: -0.10,
      Materials: -0.05,
      Energy: 0.35,           // Energy booms
      Utilities: 0.20,
      'Real Estate': -0.15,
      'Consumer Staples': 0.05,
      Healthcare: -0.05,
    },
    Deflation: {
      Technology: 0.10,       // Tech does well
      'Communication Services': 0.05,
      'Consumer Discretionary': -0.05,
      Financials: -0.15,
      Industrials: -0.05,
      Materials: -0.20,
      Energy: -0.30,          // Energy crashes
      Utilities: 0.10,
      'Real Estate': 0.20,    // Real Estate booms
      'Consumer Staples': 0.10,
      Healthcare: 0.10,
    },
  }
}

function getSectorImpact(regime: string, sector: string | null): number {
  if (!sector) return 0
  const impacts = getSectorRegimeImpact()
  const regimeImpacts = impacts[regime] || impacts.Goldilocks
  return regimeImpacts[sector] || 0
}

// ─── Get Historical Regime Distribution ────────────────────────────────

async function getRegimeDistribution(): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabase
      .from('macro_regime_history')
      .select('regime_label')
      .gte('snapshot_date', new Date(new Date().setFullYear(new Date().getFullYear() - 5)).toISOString().split('T')[0])

    if (error || !data) {
      return { Goldilocks: 0.25, Overheating: 0.25, Stagflation: 0.25, Deflation: 0.25 }
    }

    const counts = {
      Goldilocks: 0,
      Overheating: 0,
      Stagflation: 0,
      Deflation: 0,
    }

    for (const row of data) {
      counts[row.regime_label as keyof typeof counts] = (counts[row.regime_label as keyof typeof counts] || 0) + 1
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    return {
      Goldilocks: counts.Goldilocks / total || 0.25,
      Overheating: counts.Overheating / total || 0.25,
      Stagflation: counts.Stagflation / total || 0.25,
      Deflation: counts.Deflation / total || 0.25,
    }
  } catch {
    return { Goldilocks: 0.25, Overheating: 0.25, Stagflation: 0.25, Deflation: 0.25 }
  }
}

// ─── Calculate Macro Backtest Results ──────────────────────────────────

async function calculateMacroReturns(
  ticker: string,
  sector: string | null,
  enhReturn5y: number | null,
  enhReturn3y: number | null,
  enhReturn1y: number | null,
  enhInvested5y: number | null,
  enhInvested3y: number | null,
  enhInvested1y: number | null,
  regimeDistribution: Record<string, number>
) {
  // Calculate weighted impact based on regime distribution
  const regimes = ['Goldilocks', 'Overheating', 'Stagflation', 'Deflation']
  let weightedImpact = 0

  for (const regime of regimes) {
    const impact = getSectorImpact(regime, sector)
    const weight = regimeDistribution[regime] || 0
    weightedImpact += impact * weight
  }

  // Apply impact to returns
  const macroReturn5y = enhReturn5y !== null ? enhReturn5y * (1 + weightedImpact) : null
  const macroReturn3y = enhReturn3y !== null ? enhReturn3y * (1 + weightedImpact) : null
  const macroReturn1y = enhReturn1y !== null ? enhReturn1y * (1 + weightedImpact) : null

  // Calculate final values
  const macroFinalValue5y = enhInvested5y !== null ? (enhInvested5y * (1 + (macroReturn5y || 0) / 100)) : null
  const macroFinalValue3y = enhInvested3y !== null ? (enhInvested3y * (1 + (macroReturn3y || 0) / 100)) : null
  const macroFinalValue1y = enhInvested1y !== null ? (enhInvested1y * (1 + (macroReturn1y || 0) / 100)) : null

  // Calculate alpha
  const alpha5y = macroReturn5y !== null && enhReturn5y !== null ? macroReturn5y - enhReturn5y : null

  return {
    macroReturn5y,
    macroReturn3y,
    macroReturn1y,
    macroFinalValue5y,
    macroFinalValue3y,
    macroFinalValue1y,
    alpha5y,
    weightedImpact,
  }
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  try {
    console.log('Calculating macro backtest results (simplified)...')

    // Get regime distribution
    const regimeDistribution = await getRegimeDistribution()
    console.log(`Regime distribution (5Y): Goldilocks ${(regimeDistribution.Goldilocks * 100).toFixed(1)}%, Overheating ${(regimeDistribution.Overheating * 100).toFixed(1)}%, Stagflation ${(regimeDistribution.Stagflation * 100).toFixed(1)}%, Deflation ${(regimeDistribution.Deflation * 100).toFixed(1)}%`)

    // Fetch all assets first (for ID mapping)
    const { data: assetsList, error: assetsError } = await supabase
      .from('assets')
      .select('id, ticker')

    if (assetsError || !assetsList) {
      throw new Error(`Failed to fetch assets: ${assetsError?.message}`)
    }

    const assetMap = new Map(assetsList.map((a: any) => [a.ticker.toUpperCase(), a.id]))

    // Fetch all backtest data
    const { data: backtests, error: btError } = await supabase
      .from('backtest_summary')
      .select('id, ticker, sector, std_return_5y, std_return_3y, std_return_1y, std_invested_5y, std_invested_3y, std_invested_1y')

    if (btError || !backtests) {
      throw new Error(`Failed to fetch backtests: ${btError?.message}`)
    }

    console.log(`Found ${backtests.length} backtest records`)

    let processed = 0
    const rows: any[] = []

    for (const bt of backtests) {
      try {
        const assetId = assetMap.get(bt.ticker.toUpperCase())
        if (!assetId) {
          console.warn(`No asset ID found for ${bt.ticker}`)
          continue
        }

        const results = await calculateMacroReturns(
          bt.ticker,
          bt.sector,
          bt.std_return_5y,
          bt.std_return_3y,
          bt.std_return_1y,
          bt.std_invested_5y,
          bt.std_invested_3y,
          bt.std_invested_1y,
          regimeDistribution
        )

        rows.push({
          asset_id: assetId,
          ticker: bt.ticker,
          sector: bt.sector,
          macro_return_5y: results.macroReturn5y !== null ? Math.round(results.macroReturn5y * 100) / 100 : null,
          macro_return_3y: results.macroReturn3y !== null ? Math.round(results.macroReturn3y * 100) / 100 : null,
          macro_return_1y: results.macroReturn1y !== null ? Math.round(results.macroReturn1y * 100) / 100 : null,
          macro_invested_5y: Math.round((results.macroFinalValue5y || bt.std_invested_5y || 0) * 100) / 100,
          macro_invested_3y: Math.round((results.macroFinalValue3y || bt.std_invested_3y || 0) * 100) / 100,
          macro_invested_1y: Math.round((results.macroFinalValue1y || bt.std_invested_1y || 0) * 100) / 100,
          macro_final_value_5y: results.macroFinalValue5y !== null ? Math.round(results.macroFinalValue5y * 100) / 100 : null,
          macro_final_value_3y: results.macroFinalValue3y !== null ? Math.round(results.macroFinalValue3y * 100) / 100 : null,
          macro_final_value_1y: results.macroFinalValue1y !== null ? Math.round(results.macroFinalValue1y * 100) / 100 : null,
          macro_buy_count_5y: 0,  // Placeholder - requires signal history
          macro_buy_count_3y: 0,  // Placeholder - requires signal history
          macro_buy_count_1y: 0,  // Placeholder - requires signal history
          macro_skip_count_5y: 0, // Placeholder
          standard_dca_return_5y: bt.std_return_5y || null,
          alpha_vs_standard_5y: results.alpha5y !== null ? Math.round(results.alpha5y * 100) / 100 : null,
          regime_goldilocks_pct: Math.round(regimeDistribution.Goldilocks * 10000) / 100,
          regime_overheating_pct: Math.round(regimeDistribution.Overheating * 10000) / 100,
          regime_stagflation_pct: Math.round(regimeDistribution.Stagflation * 10000) / 100,
          regime_deflation_pct: Math.round(regimeDistribution.Deflation * 10000) / 100,
          calculated_at: new Date().toISOString(),
        })

        processed++
        if (processed % 100 === 0) {
          console.log(`Processed ${processed} records...`)
        }
      } catch (error) {
        console.error(`Error processing ${bt.ticker}:`, error)
      }
    }

    // Bulk upsert
    if (rows.length > 0) {
      console.log(`\nUpserting ${rows.length} macro backtest results...`)
      const { error: upsertError } = await supabase
        .from('asset_backtest_macro')
        .upsert(rows, { onConflict: 'ticker' })

      if (upsertError) {
        console.error(`Upsert error: ${upsertError.message}`)
      } else {
        console.log(`✓ Successfully upserted all macro backtest results`)
      }
    }

    console.log(`\n✓ Macro backtest calculation complete: ${processed} processed`)
  } catch (error) {
    console.error('Error in macro backtest calculation:', error)
    process.exit(1)
  }
}

main()
