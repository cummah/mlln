/**
 * compute-conviction-scores.ts
 *
 * Computes institutional-grade conviction scores for app/asset:
 * - Fundamental Quality Score (z-scored factors, macro-weighted blend)
 * - DCA Suitability Score (existing logic)
 * - Final Conviction Score (blend of fundamental + DCA)
 * - Staleness Penalty (time-decay on fundamentals)
 *
 * Stores results in asset_scores table (isolated from dashboard)
 *
 * Run with: npx ts-node --project tsconfig.scripts.json scripts/compute-conviction-scores.ts
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

// PostgREST caps rows per request at 1000 — page through for any query that can exceed it.
async function fetchAllPaginated<T>(
  buildQuery: (rangeStart: number, rangeEnd: number) => PromiseLike<{ data: T[] | null; error: any }>
): Promise<T[]> {
  const pageSize = 1000
  const rows: T[] = []
  for (let page = 0; ; page++) {
    const { data, error } = await buildQuery(page * pageSize, page * pageSize + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < pageSize) break
  }
  return rows
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Asset {
  id: number
  ticker: string
  sector: string
  roic: number | null
  gross_profitability: number | null
  ev_ebitda: number | null
  ev_fcf: number | null
  operating_cash_flow: number | null
  beta: number | null
  fundamentals_last_updated: string | null
}

interface SectorRegimeModifier {
  regime: string
  sector: string
  modifier: number
}

interface BacktestRow {
  id: number
  asset_id: number
  dca_suitability_score: number | null
}

interface FactorExposures {
  z_roic: number | null
  z_profitability: number | null
  z_ev_ebitda: number | null
  z_ev_fcf: number | null
  z_ocf: number | null
  z_beta: number | null
}

interface MacroRegimeWeights {
  regimeState: string
  weight_quality: number
  weight_value: number
  weight_growth: number
}

// ─── Calculate Z-Scores ───────────────────────────────────────────────────────

function calculateZScore(value: number | null, mean: number, stddev: number): number | null {
  if (value === null || stddev === 0) return null
  return (value - mean) / stddev
}

// ─── Compute Sector Statistics ────────────────────────────────────────────────

async function getSectorStats(
  sector: string
): Promise<{ [key: string]: { mean: number; stddev: number } }> {
  try {
    const sectorAssets = await fetchAllPaginated((start, end) =>
      supabase
        .from('assets')
        .select('roic, gross_profitability, ev_ebitda, ev_fcf, operating_cash_flow, beta')
        .eq('sector', sector)
        .eq('is_active', true)
        .range(start, end)
    )

    if (sectorAssets.length === 0) {
      console.warn(`No assets found for sector ${sector}`)
      return {}
    }

    const stats: { [key: string]: { mean: number; stddev: number } } = {}

    // Calculate statistics for each metric
    const metrics = [
      'roic',
      'gross_profitability',
      'ev_ebitda',
      'ev_fcf',
      'operating_cash_flow',
      'beta',
    ]

    for (const metric of metrics) {
      const values = sectorAssets
        .map((a: any) => a[metric])
        .filter((v: any) => v !== null) as number[]

      if (values.length === 0) {
        stats[metric] = { mean: 0, stddev: 1 }
        continue
      }

      const mean = values.reduce((a, b) => a + b, 0) / values.length
      const variance =
        values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
        values.length
      const stddev = Math.sqrt(variance)

      stats[metric] = { mean, stddev: stddev === 0 ? 1 : stddev }
    }

    return stats
  } catch (error) {
    console.error(`Error calculating sector stats for ${sector}:`, error)
    return {}
  }
}

// ─── Sector-Regime Sensitivity Modifiers (Solution 2) ──────────────────────

function getSectorRegimeModifiers(): Record<string, Record<string, number>> {
  return {
    Goldilocks: {
      Technology: 1.15,
      'Communication Services': 1.10,
      'Consumer Discretionary': 1.05,
      Financials: 1.00,
      'Industrials': 0.95,
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

function getSectorRegimeModifier(regime: string, sector: string | null): number {
  if (!sector) return 1.0 // No sector info, use neutral

  const modifiers = getSectorRegimeModifiers()
  const regimeModifiers = modifiers[regime] || modifiers.Goldilocks // Fallback to Goldilocks

  return regimeModifiers[sector] || 1.0 // Fallback to neutral (1.0)
}

// ─── Calculate Staleness Penalty ──────────────────────────────────────────────

function calculateStalenessPenalty(lastUpdated: string | null): number {
  if (!lastUpdated) return 0.5 // Heavy penalty if no update

  const daysSinceUpdate =
    (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24)
  const lambda = 0.05 // Decay constant: -5% per day

  return Math.exp(-lambda * daysSinceUpdate)
}

// ─── Compute Fundamental Quality Score ─────────────────────────────────────────

async function computeFundamentalQualityScore(
  asset: Asset,
  regimeWeights: MacroRegimeWeights
): Promise<{
  score: number
  exposures: FactorExposures
}> {
  // Get sector statistics
  const sectorStats = await getSectorStats(asset.sector)

  // Calculate Z-scores for quality factors
  const exposures: FactorExposures = {
    z_roic: calculateZScore(
      asset.roic,
      sectorStats.roic?.mean || 0,
      sectorStats.roic?.stddev || 1
    ),
    z_profitability: calculateZScore(
      asset.gross_profitability,
      sectorStats.gross_profitability?.mean || 0,
      sectorStats.gross_profitability?.stddev || 1
    ),
    z_ev_ebitda: calculateZScore(
      asset.ev_ebitda,
      sectorStats.ev_ebitda?.mean || 0,
      sectorStats.ev_ebitda?.stddev || 1
    ),
    z_ev_fcf: calculateZScore(
      asset.ev_fcf,
      sectorStats.ev_fcf?.mean || 0,
      sectorStats.ev_fcf?.stddev || 1
    ),
    z_ocf: calculateZScore(
      asset.operating_cash_flow,
      sectorStats.operating_cash_flow?.mean || 0,
      sectorStats.operating_cash_flow?.stddev || 1
    ),
    z_beta: asset.beta
      ? calculateZScore(
          asset.beta,
          sectorStats.beta?.mean || 0,
          sectorStats.beta?.stddev || 1
        )
      : null,
  }

  // Group exposures into factor categories
  // Quality factors (ROIC, Profitability, OCF)
  const qualityFactors = [exposures.z_roic, exposures.z_profitability, exposures.z_ocf].filter(
    (v) => v !== null
  )
  const avgQuality =
    qualityFactors.length > 0
      ? qualityFactors.reduce((a: number, b: number) => a + b, 0) / qualityFactors.length
      : 0

  // Value factors (EV/EBITDA, EV/FCF) — inverted because lower EV multiples are better
  const valueFactors = [exposures.z_ev_ebitda, exposures.z_ev_fcf]
    .filter((v) => v !== null)
    .map((v) => -(v as number)) // Invert so lower multiples = higher score
  const avgValue =
    valueFactors.length > 0
      ? valueFactors.reduce((a: number, b: number) => a + b, 0) / valueFactors.length
      : 0

  // Growth/Risk factor (Beta) — negative beta exposure is better
  const growth = exposures.z_beta ? -Math.abs(exposures.z_beta) : 0

  // Blend using regime weights
  const compositeScore =
    regimeWeights.weight_quality * avgQuality +
    regimeWeights.weight_value * avgValue +
    regimeWeights.weight_growth * growth

  // Normalize to 0-100 scale (z-scores are typically -3 to +3)
  // Multiplier of 25 spreads across full 0-100 range
  const normalizedScore = Math.max(0, Math.min(100, 50 + compositeScore * 25))

  return {
    score: normalizedScore,
    exposures,
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  try {
    console.log('Starting conviction score computation...')

    // Get current macro regime
    const { data: macroData } = await supabase
      .from('macro_regime_current')
      .select('regime_label')
      .limit(1)

    if (!macroData || macroData.length === 0) {
      console.warn('No macro regime data found, using default (Goldilocks)')
    }

    const currentRegime = macroData?.[0]?.regime_label || 'Goldilocks'

    // Get regime weights
    const { data: weightsData, error: weightsError } = await supabase
      .from('macro_regime_weights')
      .select('*')
      .eq('regime_state', currentRegime)

    if (weightsError || !weightsData || weightsData.length === 0) {
      console.warn(`No weights found for regime ${currentRegime}`)
      return
    }

    const regimeWeights = weightsData[0]

    // Fetch all assets with fundamentals
    const assets = await fetchAllPaginated((start, end) =>
      supabase
        .from('assets')
        .select('id, ticker, sector, roic, gross_profitability, ev_ebitda, ev_fcf, operating_cash_flow, beta, fundamentals_last_updated')
        .eq('is_active', true)
        .range(start, end)
    )

    console.log(`Computing scores for ${assets.length} assets...`)

    let computed = 0
    let failed = 0
    const historyRows: any[] = []
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

    for (const asset of assets) {
      try {
        // Compute fundamental quality score
        const { score: fundamentalScore, exposures } =
          await computeFundamentalQualityScore(asset, regimeWeights)

        // Get DCA score from backtest_summary
        const { data: backtest, error: btError } = await supabase
          .from('backtest_summary')
          .select('dca_suitability_score')
          .eq('ticker', asset.ticker.toUpperCase())
          .single()

        if (btError || !backtest) {
          console.warn(`No backtest data for ${asset.ticker}`)
        }

        const dcaScore = backtest?.dca_suitability_score ?? 50

        // Calculate staleness penalty
        const stalenessPenalty = calculateStalenessPenalty(asset.fundamentals_last_updated)

        // Solution 2: Macro-Sector Sensitivity Modifier
        // Final conviction = DCA Score * Sector-Regime Modifier
        // This removes look-ahead bias from fundamentals while preserving sector rotation benefit
        const sectorModifier = getSectorRegimeModifier(currentRegime, asset.sector)
        const finalConvictionScore = dcaScore * sectorModifier

        // Note: fundamentalScore is still computed for UI display (asset details)
        // But the backtest equation uses only DCA + macro-sector sensitivity

        const fundamentalRounded = Math.round(fundamentalScore * 100) / 100
        const convictionRounded = Math.round(
          Math.max(0, Math.min(100, finalConvictionScore)) * 100
        ) / 100
        const penaltyRounded = Math.round(stalenessPenalty * 10000) / 10000
        const modifierRounded = Math.round(sectorModifier * 10000) / 10000

        // Upsert into asset_scores
        const { error: scoreError } = await supabase
          .from('asset_scores')
          .upsert({
            asset_id: asset.id,
            fundamental_quality_score: fundamentalRounded,
            dca_suitability_score: dcaScore,
            final_conviction_score: convictionRounded,
            factor_exposures: exposures,
            macro_regime_state: currentRegime,
            regime_weights: {
              quality: regimeWeights.weight_quality,
              value: regimeWeights.weight_value,
              growth: regimeWeights.weight_growth,
            },
            sector_modifier: modifierRounded,
            staleness_penalty: penaltyRounded,
            computed_at: new Date().toISOString(),
          }, {
            onConflict: 'asset_id',
          })

        if (scoreError) {
          console.error(`Failed to upsert score for ${asset.ticker}: ${scoreError.message}`)
          failed++
          continue
        }

        // Collect history row for bulk insert
        historyRows.push({
          asset_id: asset.id,
          snapshot_date: today,
          fundamental_quality_score: fundamentalRounded,
          dca_suitability_score: dcaScore,
          final_conviction_score: convictionRounded,
          macro_regime_state: currentRegime,
          sector_modifier: modifierRounded,
          staleness_penalty: penaltyRounded,
        })

        computed++
      } catch (error) {
        console.error(`Error computing score for ${asset.ticker}:`, error)
        failed++
      }
    }

    // Bulk insert history rows with ON CONFLICT DO UPDATE
    if (historyRows.length > 0) {
      console.log(`\nInserting ${historyRows.length} history rows for ${today}...`)
      const { error: historyError } = await supabase
        .from('asset_scores_history')
        .upsert(historyRows, {
          onConflict: 'asset_id,snapshot_date',
        })

      if (historyError) {
        console.error(`Failed to insert history rows: ${historyError.message}`)
      } else {
        console.log(`✓ History rows inserted/updated for ${today}`)
      }
    }

    console.log(
      `\n✓ Completed: ${computed} scores computed, ${failed} failed out of ${assets.length}`
    )
    console.log(`Current macro regime: ${currentRegime}`)
  } catch (error) {
    console.error('Error computing conviction scores:', error)
    process.exit(1)
  }
}

main()
