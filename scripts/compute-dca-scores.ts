/**
 * compute-dca-scores.ts
 *
 * Computes the Enhanced DCA Suitability Score (1–100) for every asset
 * in backtest_summary and writes the result to the dca_suitability_score column.
 *
 * Scoring methodology: see types/score-methodology.md
 *
 * Run with: npx ts-node --project tsconfig.scripts.json scripts/compute-dca-scores.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env.local (same pattern as other scripts in this project)
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface BacktestRow {
  id: number
  ticker: string
  name: string
  sector: string

  alpha_1m: number | null
  alpha_3m: number | null
  alpha_1y: number | null
  alpha_3y: number | null
  alpha_5y: number | null

  monthly_alpha_1y: number | null
  monthly_alpha_3y: number | null
  monthly_alpha_5y: number | null

  enh_return_1y: number | null
  enh_return_3y: number | null
  enh_return_5y: number | null

  enh_avg_entry_5y: number | null
  std_avg_entry_5y: number | null

  enh_value_5y: number | null
  enh_invested_5y: number | null
  std_value_5y: number | null
  std_invested_5y: number | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns the percentile rank of `value` within `arr` (0–1) */
function percentileRank(value: number, arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const below = sorted.filter(v => v < value).length
  return below / sorted.length
}

/** Clamp a value between min and max */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

function computeScore(row: BacktestRow, universe: BacktestRow[]): number {
  let score = 0

  // ── Component 1: Alpha Consistency (35 pts) ──────────────────────────────

  // 1a. Alpha Magnitude (20 pts) — avg of 1y/3y/5y weekly alpha, percentile-ranked
  const longTermAlphas = [row.alpha_1y, row.alpha_3y, row.alpha_5y].filter(v => v != null) as number[]
  const avgLongAlpha = longTermAlphas.length > 0
    ? longTermAlphas.reduce((a, b) => a + b, 0) / longTermAlphas.length
    : null

  if (avgLongAlpha != null && avgLongAlpha > 0) {
    const universeAvgAlphas = universe.map(r => {
      const vals = [r.alpha_1y, r.alpha_3y, r.alpha_5y].filter(v => v != null) as number[]
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    })
    const pct = percentileRank(avgLongAlpha, universeAvgAlphas)
    score += clamp(pct * 20, 0, 20)
  }
  // Negative avg alpha → 0 pts for this sub-component

  // 1b. Directional Consistency (15 pts) — 3 pts per window with positive alpha
  const alphaWindows = [row.alpha_1m, row.alpha_3m, row.alpha_1y, row.alpha_3y, row.alpha_5y]
  const positiveAlphaCount = alphaWindows.filter(v => v != null && v > 0).length
  score += positiveAlphaCount * 3

  // ── Component 2: Absolute Profitability (25 pts) ─────────────────────────

  const return5yNegative = row.enh_return_5y != null && row.enh_return_5y < 0

  if (return5yNegative) {
    // Hard cap at 5pts for structurally declining assets
    score += 5
  } else {
    // 5Y profitable base: 12pts, scaled by percentile magnitude
    if (row.enh_return_5y != null && row.enh_return_5y > 0) {
      const universe5y = universe.map(r => r.enh_return_5y ?? 0)
      const pct5y = percentileRank(row.enh_return_5y, universe5y)
      score += clamp(pct5y * 12, 0, 12)
    }

    // 3Y profitable base: 8pts, scaled by percentile magnitude
    if (row.enh_return_3y != null && row.enh_return_3y > 0) {
      const universe3y = universe.map(r => r.enh_return_3y ?? 0)
      const pct3y = percentileRank(row.enh_return_3y, universe3y)
      score += clamp(pct3y * 8, 0, 8)
    }

    // 1Y profitable base: 5pts, scaled by percentile magnitude
    if (row.enh_return_1y != null && row.enh_return_1y > 0) {
      const universe1y = universe.map(r => r.enh_return_1y ?? 0)
      const pct1y = percentileRank(row.enh_return_1y, universe1y)
      score += clamp(pct1y * 5, 0, 5)
    }
  }

  // ── Component 3: Capital Efficiency (20 pts) ─────────────────────────────

  // 3a. Average Entry Discount (12 pts)
  if (
    row.enh_avg_entry_5y != null &&
    row.std_avg_entry_5y != null &&
    row.std_avg_entry_5y > 0
  ) {
    const discount = (row.std_avg_entry_5y - row.enh_avg_entry_5y) / row.std_avg_entry_5y * 100
    if (discount > 0) {
      const universeDiscounts = universe
        .filter(r => r.enh_avg_entry_5y != null && r.std_avg_entry_5y != null && r.std_avg_entry_5y! > 0)
        .map(r => (r.std_avg_entry_5y! - r.enh_avg_entry_5y!) / r.std_avg_entry_5y! * 100)
      const pct = percentileRank(discount, universeDiscounts)
      score += clamp(pct * 12, 0, 12)
    }
    // Negative discount (ENH buying higher) → 0 pts
  }

  // 3b. Return per Dollar Invested (8 pts)
  if (
    row.enh_value_5y != null && row.enh_invested_5y != null && row.enh_invested_5y > 0 &&
    row.std_value_5y != null && row.std_invested_5y != null && row.std_invested_5y > 0
  ) {
    const enhEfficiency = row.enh_value_5y / row.enh_invested_5y
    const stdEfficiency = row.std_value_5y / row.std_invested_5y
    const efficiencyRatio = enhEfficiency / stdEfficiency
    if (efficiencyRatio > 1.0) {
      const universeRatios = universe
        .filter(r =>
          r.enh_value_5y != null && r.enh_invested_5y != null && r.enh_invested_5y! > 0 &&
          r.std_value_5y != null && r.std_invested_5y != null && r.std_invested_5y! > 0
        )
        .map(r => (r.enh_value_5y! / r.enh_invested_5y!) / (r.std_value_5y! / r.std_invested_5y!))
      const pct = percentileRank(efficiencyRatio, universeRatios)
      score += clamp(pct * 8, 0, 8)
    }
    // Ratio ≤ 1.0 → 0 pts
  }

  // ── Component 4: Short-Term Defence (10 pts) ─────────────────────────────

  if (row.alpha_1m != null && row.alpha_1m > 0) score += 5
  if (row.alpha_3m != null && row.alpha_3m > 0) score += 5

  // ── Component 5: Weekly/Monthly Signal Convergence (10 pts) ──────────────

  // 3.33 pts per window where BOTH weekly and monthly alpha are positive
  const convergenceWindows = [
    [row.alpha_1y, row.monthly_alpha_1y],
    [row.alpha_3y, row.monthly_alpha_3y],
    [row.alpha_5y, row.monthly_alpha_5y],
  ]
  const convergingCount = convergenceWindows.filter(
    ([wk, mo]) => wk != null && mo != null && wk > 0 && mo > 0
  ).length
  score += Math.round(convergingCount * 3.33)

  // ── Overall Ceiling: Absolute Loss Severity ──────────────────────────────
  // Components 1, 4, and 5 (55 of 100 pts) score alpha vs. Standard DCA and
  // don't look at absolute returns. An asset can rack up most of those points
  // purely by losing less than Standard DCA, even while losing heavily in
  // absolute terms — the Component 2 cap alone (5pts within its own 25-pt
  // budget) isn't enough to stop that from reading as "Good" overall. Cap the
  // total score by how negative enh_return_5y is so severe, structural losses
  // can't be alpha-washed into a misleadingly high rating.
  let ceiling = 100
  if (row.enh_return_5y != null) {
    if (row.enh_return_5y <= -50) ceiling = 25
    else if (row.enh_return_5y <= -30) ceiling = 40
    else if (row.enh_return_5y <= -10) ceiling = 55
    else if (row.enh_return_5y < 0) ceiling = 70
  }

  // ── Final: clamp to 1–100 ────────────────────────────────────────────────
  return clamp(Math.round(Math.min(score, ceiling)), 1, 100)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('==========================================')
  console.log('   Compute Enhanced DCA Suitability Scores')
  console.log('==========================================\n')

  // 1. Fetch all rows
  console.log('Fetching backtest_summary rows...')
  const allRows: BacktestRow[] = []
  let offset = 0
  const PAGE = 500

  while (true) {
    const { data, error } = await supabase
      .from('backtest_summary')
      .select(`
        id, ticker, name, sector,
        alpha_1m, alpha_3m, alpha_1y, alpha_3y, alpha_5y,
        monthly_alpha_1y, monthly_alpha_3y, monthly_alpha_5y,
        enh_return_1y, enh_return_3y, enh_return_5y,
        enh_avg_entry_5y, std_avg_entry_5y,
        enh_value_5y, enh_invested_5y, std_value_5y, std_invested_5y
      `)
      .range(offset, offset + PAGE - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    allRows.push(...(data as BacktestRow[]))
    offset += PAGE
    if (data.length < PAGE) break
  }

  console.log(`Loaded ${allRows.length} assets\n`)

  // 2. Compute scores
  console.log('Computing scores...')
  const scored = allRows.map(row => ({
    id: row.id,
    ticker: row.ticker,
    score: computeScore(row, allRows),
  }))

  // 3. Print distribution
  const bands = [
    { label: '80–100 (Excellent)', min: 80, max: 100 },
    { label: '60–79  (Good)',      min: 60, max: 79  },
    { label: '40–59  (Marginal)',  min: 40, max: 59  },
    { label: '20–39  (Poor fit)',  min: 20, max: 39  },
    { label: '1–19   (Unsuitable)',min: 1,  max: 19  },
  ]
  console.log('\nScore distribution:')
  for (const { label, min, max } of bands) {
    const count = scored.filter(s => s.score >= min && s.score <= max).length
    const pct = (count / scored.length * 100).toFixed(1)
    console.log(`  ${label}: ${count} assets (${pct}%)`)
  }

  // Top 10
  const top10 = [...scored].sort((a, b) => b.score - a.score).slice(0, 10)
  console.log('\nTop 10 assets by suitability score:')
  top10.forEach(({ ticker, score }) => console.log(`  ${ticker}: ${score}`))

  // Bottom 10
  const bottom10 = [...scored].sort((a, b) => a.score - b.score).slice(0, 10)
  console.log('\nBottom 10 assets by suitability score:')
  bottom10.forEach(({ ticker, score }) => console.log(`  ${ticker}: ${score}`))

  // 4. Upsert scores in chunks (batch updates to reduce IO)
  console.log('\nUpserting scores to backtest_summary...')
  const CHUNK = 50
  let upserted = 0

  for (let i = 0; i < scored.length; i += CHUNK) {
    const chunk = scored.slice(i, i + CHUNK)

    // Build update rows with ticker for upsert
    const updateRows = chunk.map(({ ticker, score }) => ({
      ticker,
      dca_suitability_score: score,
    }))

    const { error } = await supabase
      .from('backtest_summary')
      .upsert(updateRows, { onConflict: 'ticker' })

    if (error) {
      console.error(`Error upserting chunk at offset ${i}:`, error.message)
    } else {
      upserted += chunk.length
      process.stdout.write(`\r  Upserted ${upserted}/${scored.length}`)
    }
  }

  console.log('\n\n==========================================')
  console.log('        SCORING COMPLETE')
  console.log('==========================================')
  console.log(`Total scored: ${scored.length}`)
  console.log(`Avg score:    ${(scored.reduce((a, b) => a + b.score, 0) / scored.length).toFixed(1)}`)
  console.log(`Max score:    ${Math.max(...scored.map(s => s.score))}`)
  console.log(`Min score:    ${Math.min(...scored.map(s => s.score))}`)
  console.log('==========================================\n')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
