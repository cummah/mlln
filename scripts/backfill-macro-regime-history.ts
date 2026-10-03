/**
 * backfill-macro-regime-history.ts
 *
 * Fetches 5 years of historical FRED data and classifies macro regimes retroactively
 * Populates macro_regime_history table with daily regime classifications
 *
 * Run with: npx ts-node --project tsconfig.scripts.json scripts/backfill-macro-regime-history.ts
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

const FRED_API_KEY = process.env.FRED_API_KEY

// ─── FRED API Fetching ────────────────────────────────────────────────────────

async function fetchFredSeries(seriesId: string, startDate: string, endDate: string): Promise<any[]> {
  try {
    const url = new URL('https://api.stlouisfed.org/fred/series/observations')
    url.searchParams.append('series_id', seriesId)
    url.searchParams.append('api_key', FRED_API_KEY!)
    url.searchParams.append('file_type', 'json')
    url.searchParams.append('observation_start', startDate)
    url.searchParams.append('observation_end', endDate)

    const response = await fetch(url.toString())
    if (!response.ok) {
      console.warn(`FRED API error for ${seriesId}: ${response.status}`)
      return []
    }

    const data: any = await response.json()
    return data.observations || []
  } catch (error) {
    console.error(`Error fetching FRED ${seriesId}:`, error)
    return []
  }
}

// ─── Classify Regime ──────────────────────────────────────────────────────────

interface MacroIndicators {
  vixLevel: number | null
  yieldCurveSlope: number | null
  inflationRate: number | null
  unemploymentRate: number | null
  nonfarmPayrolls: number | null
}

function classifyRegime(indicators: MacroIndicators): string {
  const { vixLevel, yieldCurveSlope } = indicators

  // VIX-based classification (most reliable daily signal)
  if (vixLevel) {
    if (vixLevel > 30) return 'Overheating' // High volatility stress
    if (vixLevel < 12) return 'Goldilocks' // Low volatility, stable
    if (vixLevel > 20 && yieldCurveSlope && yieldCurveSlope < -0.5) {
      return 'Stagflation' // High vol + inverted yield = stagflation signals
    }
  }

  // Yield curve inversion alone = deflation risk
  if (yieldCurveSlope && yieldCurveSlope < -1.5) {
    return 'Deflation'
  }

  // Default to Goldilocks
  return 'Goldilocks'
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  try {
    console.log('Backfilling macro regime history from FRED API...')

    if (!FRED_API_KEY) {
      throw new Error('FRED_API_KEY not set in .env')
    }

    // Date range: 5 years back to today
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    console.log(`Fetching FRED data from ${startDate} to ${endDate}...`)

    // Fetch key indicators in parallel
    const [vixData, yieldData, inflationData, unemploymentData] = await Promise.all([
      fetchFredSeries('VIXCLS', startDate, endDate), // VIX
      fetchFredSeries('T10Y2Y', startDate, endDate), // 10Y-2Y spread (yield curve slope)
      fetchFredSeries('CPIAUCSL', startDate, endDate), // CPI (inflation)
      fetchFredSeries('UNRATE', startDate, endDate), // Unemployment rate
    ])

    console.log(`VIX data points: ${vixData.length}`)
    console.log(`Yield curve data points: ${yieldData.length}`)
    console.log(`Inflation data points: ${inflationData.length}`)
    console.log(`Unemployment data points: ${unemploymentData.length}`)

    // Build daily lookup maps
    const vixMap = new Map(vixData.map(d => [d.date, parseFloat(d.value)]))
    const yieldMap = new Map(yieldData.map(d => [d.date, parseFloat(d.value)]))
    const inflationMap = new Map(inflationData.map(d => [d.date, parseFloat(d.value)]))
    const unemploymentMap = new Map(unemploymentData.map(d => [d.date, parseFloat(d.value)]))

    // Generate daily regimes
    const regimeHistory: Array<{ date: string; regime: string; vix: number | null; yield: number | null; inflation: number | null; unemployment: number | null }> = []

    const currentDate = new Date(startDate)
    const endDateObj = new Date(endDate)

    while (currentDate <= endDateObj) {
      const dateStr = currentDate.toISOString().split('T')[0]

      const vix = vixMap.get(dateStr) || null
      const yieldSlope = yieldMap.get(dateStr) || null
      const inflation = inflationMap.get(dateStr) || null
      const unemployment = unemploymentMap.get(dateStr) || null

      // Use forward-fill for missing values (use previous day's value)
      let prevVix = vix
      let prevYield = yieldSlope
      let prevInflation = inflation
      let prevUnemployment = unemployment

      if (!vix && regimeHistory.length > 0) {
        const prev = regimeHistory[regimeHistory.length - 1]
        prevVix = prev.vix
      }
      if (!yieldSlope && regimeHistory.length > 0) {
        const prev = regimeHistory[regimeHistory.length - 1]
        prevYield = prev.yield
      }
      if (!inflation && regimeHistory.length > 0) {
        const prev = regimeHistory[regimeHistory.length - 1]
        prevInflation = prev.inflation
      }
      if (!unemployment && regimeHistory.length > 0) {
        const prev = regimeHistory[regimeHistory.length - 1]
        prevUnemployment = prev.unemployment
      }

      const regime = classifyRegime({
        vixLevel: prevVix,
        yieldCurveSlope: prevYield,
        inflationRate: prevInflation,
        unemploymentRate: prevUnemployment,
        nonfarmPayrolls: null,
      })

      regimeHistory.push({
        date: dateStr,
        regime,
        vix: prevVix,
        yield: prevYield,
        inflation: prevInflation,
        unemployment: prevUnemployment,
      })

      currentDate.setDate(currentDate.getDate() + 1)
    }

    console.log(`Generated ${regimeHistory.length} daily regime classifications`)

    // Upsert into database in batches
    const BATCH_SIZE = 500
    for (let i = 0; i < regimeHistory.length; i += BATCH_SIZE) {
      const batch = regimeHistory.slice(i, i + BATCH_SIZE)
      const { error } = await supabase
        .from('macro_regime_history')
        .upsert(
          batch.map(r => ({
            snapshot_date: r.date,
            regime_label: r.regime,
            vix_level: r.vix,
            yield_curve_spread: r.yield,
          })),
          { onConflict: 'snapshot_date' }
        )

      if (error) {
        console.error(`Failed to insert batch ${i / BATCH_SIZE + 1}: ${error.message}`)
      } else {
        console.log(`✓ Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(regimeHistory.length / BATCH_SIZE)}`)
      }
    }

    console.log(`\n✓ Macro regime history backfilled: ${regimeHistory.length} days`)
  } catch (error) {
    console.error('Error backfilling regime history:', error)
    process.exit(1)
  }
}

main()
