/**
 * update-macro-regime.ts
 *
 * Fetches macro indicators from FRED API and Yahoo Finance
 * Classifies current macro regime (Goldilocks, Overheating, Stagflation, Deflation)
 * Updates macro_regime_current and macro_regime_history tables
 *
 * Run with: npx ts-node --project tsconfig.scripts.json scripts/update-macro-regime.ts
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

const FRED_API_KEY = process.env.FRED_API_KEY

// Force fresh schema introspection
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: {
      schema: 'public',
    },
  }
)

// ─── Types ────────────────────────────────────────────────────────────────────

interface MacroIndicators {
  yieldCurveSpread: number | null  // 10Y - 2Y spread (FRED: T10Y2Y)
  creditSpread: number | null      // HY OAS (FRED: BAMLH0A0HYM2)
  vixLevel: number | null          // VIX index (Yahoo Finance: ^VIX)
  us1mPCE: number | null           // PCE inflation (FRED: MMNRNJ)
  unemploymentRate: number | null  // (FRED: UNRATE)
  gdpGrowth: number | null         // Real GDP (FRED: A191RG1Q225SBEA)
}

interface RegimeClassification {
  regimeLabel: 'Goldilocks' | 'Overheating' | 'Stagflation' | 'Deflation'
  macroScore: number
  compositeSignal: string
}

// ─── Fetch FRED Data ──────────────────────────────────────────────────────────

async function fetchFredSeries(seriesId: string): Promise<number | null> {
  if (!FRED_API_KEY) {
    console.warn('FRED_API_KEY not set, skipping FRED data')
    return null
  }

  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`FRED API error: ${response.status}`)

    const data: any = await response.json()
    const observations = data.observations || []

    if (observations.length === 0) {
      console.warn(`No observations found for FRED series ${seriesId}`)
      return null
    }

    const latest = observations[0]
    const value = latest.value === '.' ? null : parseFloat(latest.value)
    return value
  } catch (error) {
    console.error(`Error fetching FRED ${seriesId}:`, error)
    return null
  }
}

// ─── Fetch Yahoo Finance Data ─────────────────────────────────────────────────

async function fetchYahooQuote(ticker: string): Promise<number | null> {
  try {
    // Using yfinance-like endpoint (can be replaced with a proper API)
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=price`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Yahoo Finance API error: ${response.status}`)

    const data: any = await response.json()
    const price = data.quoteSummary?.result?.[0]?.price?.regularMarketPrice?.raw
    return typeof price === 'number' ? price : null
  } catch (error) {
    console.error(`Error fetching Yahoo Finance ${ticker}:`, error)
    return null
  }
}

// ─── Collect Macro Indicators ─────────────────────────────────────────────────

async function getMacroIndicators(): Promise<MacroIndicators> {
  console.log('Fetching macro indicators...')

  const [
    yieldCurveSpread,
    creditSpread,
    vixLevel,
    pceInflation,
    unemploymentRate,
    gdpGrowth,
  ] = await Promise.all([
    fetchFredSeries('T10Y2Y'),      // 10Y - 2Y spread
    fetchFredSeries('BAMLH0A0HYM2'), // HY credit spread
    fetchYahooQuote('^VIX'),         // VIX index
    fetchFredSeries('MMNRNJ'),       // PCE inflation (1M)
    fetchFredSeries('UNRATE'),       // Unemployment rate
    fetchFredSeries('A191RG1Q225SBEA'), // Real GDP growth
  ])

  return {
    yieldCurveSpread,
    creditSpread,
    vixLevel,
    us1mPCE: pceInflation,
    unemploymentRate,
    gdpGrowth,
  }
}

// ─── Classify Macro Regime ────────────────────────────────────────────────────

function classifyRegime(indicators: MacroIndicators): RegimeClassification {
  const signals: string[] = []

  // Compute Growth proxy (normalized to 0-100)
  // Based on: GDP growth, unemployment, yield curve, credit spreads, VIX
  let growthScore = 50

  if (indicators.gdpGrowth !== null) {
    // GDP growth: 0% → 0, 3% → 100
    growthScore = Math.min(100, Math.max(0, (indicators.gdpGrowth / 3) * 100))
  }

  if (indicators.unemploymentRate !== null) {
    const umScore = Math.max(0, 100 - indicators.unemploymentRate * 20) // 4% → 20, 5% → 0
    growthScore = (growthScore + umScore) / 2
  }

  if (indicators.yieldCurveSpread !== null) {
    if (indicators.yieldCurveSpread < 0) {
      signals.push('inverted yield curve')
      growthScore *= 0.8 // Recession signal
    } else if (indicators.yieldCurveSpread > 1.5) {
      signals.push('steep yield curve')
      growthScore *= 1.1
    }
  }

  if (indicators.vixLevel !== null) {
    if (indicators.vixLevel > 30) {
      signals.push('elevated volatility')
      growthScore *= 0.85
    } else if (indicators.vixLevel < 12) {
      signals.push('low volatility')
    }
  }

  // Compute Inflation level (use PCE directly, defaults to 2.0)
  const inflationLevel = indicators.us1mPCE !== null ? indicators.us1mPCE : 2.0

  if (inflationLevel > 3) {
    signals.push('high inflation')
  } else if (inflationLevel < 2) {
    signals.push('low inflation')
  }

  // Strict 4-Quadrant Classification
  let regimeLabel: 'Goldilocks' | 'Overheating' | 'Stagflation' | 'Deflation'

  if (growthScore >= 50) {
    // High Growth
    if (inflationLevel < 2.5) {
      regimeLabel = 'Goldilocks'
    } else {
      regimeLabel = 'Overheating'
    }
  } else {
    // Low Growth
    if (inflationLevel >= 2.5) {
      regimeLabel = 'Stagflation'
    } else {
      regimeLabel = 'Deflation'
    }
  }

  const compositeSignal = signals.join(', ') || 'neutral'
  const macroScore = Math.max(0, Math.min(100, growthScore))

  return {
    regimeLabel,
    macroScore,
    compositeSignal,
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  try {
    console.log('Starting macro regime update...')

    // Fetch indicators
    const indicators = await getMacroIndicators()
    console.log('Indicators:', indicators)

    // Classify regime
    const regime = classifyRegime(indicators)
    console.log('Classified regime:', regime)

    // Update macro_regime_current - just store the key metrics
    const today = new Date().toISOString().split('T')[0]

    // Delete existing row
    try {
      await supabase
        .from('macro_regime_current')
        .delete()
        .eq('id', 1)
    } catch (err) {
      // Ignore
    }

    // Insert with only basic fields
    const { error: updateError } = await supabase
      .from('macro_regime_current')
      .insert({
        id: 1,
        macro_score: regime.macroScore,
        regime_label: regime.regimeLabel,
      } as any)

    if (updateError) {
      console.warn(`Warning: Could not update macro_regime_current: ${updateError.message}`)
    }

    // Insert into history
    const { error: historyError } = await supabase
      .from('macro_regime_history')
      .insert({
        snapshot_date: today,
        macro_score: regime.macroScore,
        regime_label: regime.regimeLabel,
      } as any)

    if (historyError && !historyError.message?.includes('duplicate')) {
      console.warn(`Warning: Could not insert macro history: ${historyError?.message}`)
    }

    console.log(`✓ Updated macro regime to: ${regime.regimeLabel} (score: ${regime.macroScore})`)
  } catch (error) {
    console.error('Error updating macro regime:', error)
    process.exit(1)
  }
}

main()
