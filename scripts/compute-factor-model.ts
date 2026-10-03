/**
 * compute-factor-model.ts
 *
 * Fits a PCA statistical factor model on daily returns across the full covered universe.
 *
 * Two modes:
 *   --full: Refits PCA on full 5-year window, replaces factor_model_loadings and factor_model_history.
 *           Use for initial backfill only (expensive).
 *   --incremental (default): Reuses existing loadings, only updates factor_model_history for recent
 *                            dates. Fast - suitable for daily/weekly runs.
 *
 * Writes:
 *   - factor_model_loadings: each ticker's exposure to the top NUM_FACTORS components
 *   - factor_model_history: a date-indexed momentum z-score per factor (the "regime" signal)
 *   - asset_scores.factor_regime_score / factor_regime_label: each ticker's current blended state
 *
 * Run with:
 *   npm run compute:factor-model -- --full              # Initial backfill (one-time, expensive)
 *   npm run compute:factor-model                        # Incremental (default, fast)
 */

import { createClient } from '@supabase/supabase-js'
import { PCA } from 'ml-pca'
import * as fs from 'fs'
import * as path from 'path'

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

const NUM_FACTORS = 5
const FIT_WINDOW_YEARS = 5 // must cover the longest backtest window (5y) in compute-macro-backtest.ts
const MIN_COVERAGE_RATIO = 0.95 // ticker must have data for >=95% of the reference calendar to enter the fit
const MOMENTUM_LOOKBACK = 63 // trading days (~3 months) rolling cumulative factor score
const ZSCORE_LOOKBACK = 252 // trading days (~1 year) used to standardize the rolling momentum

const round4 = (n: number) => Math.round(n * 10000) / 10000
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const dot = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0)

interface PriceBar { date: string; close: number }

async function fetchPrices(ticker: string, startDate: string): Promise<PriceBar[]> {
  let all: PriceBar[] = []
  const pageSize = 1000
  let page = 0
  while (true) {
    const { data, error } = await supabase
      .from('daily_prices')
      .select('date, close')
      .eq('ticker', ticker)
      .gte('date', startDate)
      .order('date', { ascending: true })
      .range(page * pageSize, page * pageSize + pageSize - 1)
    if (error || !data || data.length === 0) break
    all = all.concat(data as any[])
    if (data.length < pageSize) break
    page++
  }
  return all
}

async function upsertChunked(table: string, rows: any[], onConflict: string) {
  const CHUNK = 500
  let failures = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const { error } = await supabase.from(table).upsert(chunk, { onConflict })
    if (error) {
      console.warn(`${table} chunk ${i / CHUNK} failed (${error.message}), retrying row-by-row...`)
      for (const row of chunk) {
        const { error: rowErr } = await supabase.from(table).upsert([row], { onConflict })
        if (rowErr) {
          console.error(`  x ${table} row failed: ${rowErr.message}`)
          failures++
        }
      }
    }
  }
  return failures
}

async function main() {
  const fullMode = process.argv.includes('--full')
  const incremental = !fullMode
  const limitArg = process.argv.indexOf('--limit')
  const LIMIT = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : Infinity

  console.log(`Starting ${fullMode ? 'FULL (backfill)' : 'INCREMENTAL'} factor model computation...`)

  const fitStart = new Date()
  fitStart.setFullYear(fitStart.getFullYear() - FIT_WINDOW_YEARS)
  const fitStartStr = fitStart.toISOString().split('T')[0]

  // Incremental mode: reuse existing loadings, only update recent history
  if (incremental) {
    console.log('Incremental mode: reusing existing loadings, updating recent dates only...')
    const HISTORY_WINDOW_DAYS = 14 // update last ~2 weeks of history
    const historyStartDate = new Date(Date.now() - HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Load existing loadings (with pagination)
    const loadingRows: any[] = []
    let page = 0
    while (true) {
      const { data } = await supabase
        .from('factor_model_loadings')
        .select('ticker, loadings')
        .order('ticker')
        .range(page * 1000, page * 1000 + 999)
      if (!data || data.length === 0) break
      loadingRows.push(...data)
      if (data.length < 1000) break
      page++
    }
    if (loadingRows.length === 0) {
      console.error('ERROR: No existing loadings found! Run with --full first to backfill.')
      process.exit(1)
    }
    const loadingsByTicker = new Map<string, number[]>(
      loadingRows.map(r => [r.ticker, r.loadings || []])
    )
    console.log(`Loaded ${loadingsByTicker.size} existing ticker loadings`)

    // Fetch recent prices and recompute history
    const tickers = Array.from(loadingsByTicker.keys())
    const priceMap = new Map<string, Map<string, number>>()
    const CONCURRENCY = 8
    for (let i = 0; i < tickers.length; i += CONCURRENCY) {
      const batch = tickers.slice(i, i + CONCURRENCY)
      await Promise.all(batch.map(async (ticker: string) => {
        const bars = await fetchPrices(ticker, fitStartStr)
        if (bars.length < 60) return
        const m = new Map<string, number>()
        for (const b of bars) m.set(b.date, b.close)
        priceMap.set(ticker, m)
      }))
      process.stdout.write(`\rFetched ${Math.min(i + CONCURRENCY, tickers.length)}/${tickers.length}`)
    }
    console.log(`\n${priceMap.size} tickers have usable recent price history`)

    // Build reference calendar from recent prices only
    let refDates: string[] = []
    priceMap.forEach((m) => {
      const dates = Array.from(m.keys()).sort()
      if (dates.length > refDates.length) refDates = dates
    })
    if (refDates.length < MOMENTUM_LOOKBACK) {
      console.error(`Insufficient recent price history (${refDates.length} days, need ${MOMENTUM_LOOKBACK})`)
      process.exit(1)
    }

    // Reindex and compute returns
    const returnDates = refDates.slice(1)
    const returns: number[][] = []
    for (let i = 1; i < refDates.length; i++) {
      const ret: number[] = []
      for (const ticker of tickers) {
        const m = priceMap.get(ticker)!
        const c0 = m.get(refDates[i - 1])
        const c1 = m.get(refDates[i])
        if (c0 && c1) {
          ret.push(c1 / c0 - 1)
        } else {
          ret.push(NaN)
        }
      }
      returns.push(ret)
    }

    // Compute momentum/z-scores using existing loadings
    const K = Math.min(loadingsByTicker.values().next().value?.length || 5, 5)
    const historyRows: any[] = []
    for (let i = 0; i < returnDates.length; i++) {
      const date = returnDates[i]
      if (new Date(date).getTime() < new Date(historyStartDate).getTime()) continue

      const startIdx = Math.max(0, i - MOMENTUM_LOOKBACK)
      const window = returns.slice(startIdx, i + 1)

      for (let k = 0; k < K; k++) {
        let scoreSum = 0
        let count = 0
        for (const ret of window) {
          let score = 0
          for (let j = 0; j < ret.length; j++) {
            const ticker = tickers[j]
            const loadings = loadingsByTicker.get(ticker)
            if (loadings && loadings[k] != null && !isNaN(ret[j])) {
              score += loadings[k] * ret[j]
            }
          }
          if (!isNaN(score)) { scoreSum += score; count++ }
        }
        if (count > 0) {
          const mean = scoreSum / count
          let variance = 0
          for (const ret of window) {
            let score = 0
            for (let j = 0; j < ret.length; j++) {
              const ticker = tickers[j]
              const loadings = loadingsByTicker.get(ticker)
              if (loadings && loadings[k] != null && !isNaN(ret[j])) {
                score += loadings[k] * ret[j]
              }
            }
            if (!isNaN(score)) variance += (score - mean) ** 2
          }
          const std = Math.sqrt(variance / count)
          const zscore = std > 0 ? (scoreSum / count - mean) / std : 0
          historyRows.push({ date, factor_index: k, factor_momentum_zscore: zscore })
        }
      }
    }

    if (historyRows.length > 0) {
      console.log(`Upserting ${historyRows.length} recent history rows...`)
      const CHUNK = 500
      for (let i = 0; i < historyRows.length; i += CHUNK) {
        const chunk = historyRows.slice(i, i + CHUNK)
        const { error } = await supabase.from('factor_model_history').upsert(chunk, { onConflict: 'date,factor_index' })
        if (error) console.error(`Chunk ${i / CHUNK} failed:`, error.message)
      }
    }
    console.log('✓ Incremental update complete')
    return
  }

  // 1. Active universe
  let assetRows: any[] = []
  for (let page = 0; ; page++) {
    const { data } = await supabase
      .from('assets')
      .select('id, ticker')
      .eq('is_active', true)
      .order('ticker')
      .range(page * 1000, page * 1000 + 999)
    if (!data || data.length === 0) break
    assetRows = assetRows.concat(data)
    if (data.length < 1000) break
  }
  const assets = assetRows.slice(0, LIMIT)
  const assetIdByTicker = new Map<string, number>(assets.map((a: any) => [a.ticker, a.id]))
  console.log(`Fetching prices for ${assets.length} assets since ${fitStartStr}...`)

  // 2. Fetch prices concurrently
  const priceMap = new Map<string, Map<string, number>>()
  const CONCURRENCY = 8
  for (let i = 0; i < assets.length; i += CONCURRENCY) {
    const batch = assets.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(async (asset: any) => {
      const bars = await fetchPrices(asset.ticker, fitStartStr)
      if (bars.length < 60) return
      const m = new Map<string, number>()
      for (const b of bars) m.set(b.date, b.close)
      priceMap.set(asset.ticker, m)
    }))
    process.stdout.write(`\rFetched ${Math.min(i + CONCURRENCY, assets.length)}/${assets.length}`)
  }
  console.log(`\n${priceMap.size} tickers have usable price history`)

  // 3. Reference trading calendar = the ticker with the most observed dates
  let refTicker = ''
  let refDates: string[] = []
  priceMap.forEach((m, ticker) => {
    if (m.size > refDates.length) {
      refTicker = ticker
      const keys: string[] = []
      m.forEach((_, date) => keys.push(date))
      refDates = keys.sort()
    }
  })
  if (refDates.length < ZSCORE_LOOKBACK + MOMENTUM_LOOKBACK) {
    throw new Error(`Reference calendar (${refTicker}, ${refDates.length} days) too short for a ${ZSCORE_LOOKBACK + MOMENTUM_LOOKBACK}-day warmup`)
  }
  console.log(`Reference calendar: ${refTicker}, ${refDates.length} trading days (${refDates[0]} -> ${refDates[refDates.length - 1]})`)

  // 4. Keep tickers with sufficient coverage of the reference calendar
  const kept: string[] = []
  priceMap.forEach((m, ticker) => {
    const coverage = refDates.filter(d => m.has(d)).length / refDates.length
    if (coverage >= MIN_COVERAGE_RATIO) kept.push(ticker)
  })
  console.log(`${kept.length}/${priceMap.size} tickers meet the ${MIN_COVERAGE_RATIO * 100}% coverage bar and enter the fit`)
  if (kept.length < NUM_FACTORS + 1) throw new Error(`Only ${kept.length} tickers meet the coverage bar - not enough to fit ${NUM_FACTORS} factors`)

  // 5. Reindex onto the reference calendar (forward-fill gaps, back-fill any leading gap)
  const closeMatrix: number[][] = refDates.map(() => new Array(kept.length).fill(NaN))
  kept.forEach((ticker, j) => {
    const m = priceMap.get(ticker)!
    let last: number | null = null
    for (let i = 0; i < refDates.length; i++) {
      const c = m.get(refDates[i])
      if (c != null) last = c
      closeMatrix[i][j] = last ?? NaN
    }
    let firstValid: number | null = null
    for (let i = 0; i < refDates.length; i++) {
      if (!isNaN(closeMatrix[i][j])) { firstValid = closeMatrix[i][j]; break }
    }
    if (firstValid != null) {
      for (let i = 0; i < refDates.length && isNaN(closeMatrix[i][j]); i++) closeMatrix[i][j] = firstValid
    }
  })

  // 6. Daily returns matrix (T-1 x N)
  const returnDates = refDates.slice(1)
  const returns: number[][] = []
  for (let i = 1; i < refDates.length; i++) {
    returns.push(kept.map((_, j) => closeMatrix[i][j] / closeMatrix[i - 1][j] - 1))
  }

  // 7. PCA (correlation-based: center + scale so high-vol tickers don't dominate)
  console.log(`Running PCA on a ${returns.length} x ${kept.length} return matrix...`)
  const pca = new PCA(returns, { center: true, scale: true, method: 'SVD' })
  const K = Math.min(NUM_FACTORS, kept.length - 1, returns.length - 1)
  const loadingsMatrix = pca.getLoadings().to2DArray().slice(0, K) // K x N
  const explainedVariance = pca.getExplainedVariance().slice(0, K)
  const scores = pca.predict(returns, { nComponents: K }).to2DArray() // (T-1) x K
  console.log(`Top ${K} factors explain ${(explainedVariance.reduce((a, b) => a + b, 0) * 100).toFixed(1)}% of variance:`, explainedVariance.map(v => (v * 100).toFixed(1) + '%'))

  const loadingsByTicker = new Map<string, number[]>()
  kept.forEach((ticker, j) => loadingsByTicker.set(ticker, loadingsMatrix.map(row => row[j])))

  // 8. Rolling momentum z-score per factor
  const historyRows: any[] = []
  const latestMomentum: number[] = new Array(K).fill(0)
  for (let k = 0; k < K; k++) {
    const series = scores.map(row => row[k])
    const rollingSum: (number | null)[] = series.map((_, i) => {
      if (i < MOMENTUM_LOOKBACK - 1) return null
      let s = 0
      for (let j = i - MOMENTUM_LOOKBACK + 1; j <= i; j++) s += series[j]
      return s
    })
    for (let i = 0; i < series.length; i++) {
      let z: number | null = null
      const warmupEnd = MOMENTUM_LOOKBACK - 1 + ZSCORE_LOOKBACK - 1
      if (rollingSum[i] != null && i >= warmupEnd) {
        const window = rollingSum.slice(i - ZSCORE_LOOKBACK + 1, i + 1) as number[]
        const mean = window.reduce((a, b) => a + b, 0) / window.length
        const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length
        const std = Math.sqrt(variance)
        z = std > 0 ? (rollingSum[i]! - mean) / std : 0
      }
      if (z != null) {
        historyRows.push({ date: returnDates[i], factor_index: k, factor_return: round4(series[i]), factor_momentum_zscore: round4(z) })
        if (i === series.length - 1) latestMomentum[k] = z
      }
    }
  }
  console.log(`${historyRows.length} factor-history rows computed, latest momentum vector: [${latestMomentum.map(v => v.toFixed(2)).join(', ')}]`)

  // 9. Current blended factor state per ticker
  const SCALE = 1.0 // placeholder - calibrate against the real rawScore distribution logged above/below, then hardcode
  const rawScores = kept.map(ticker => dot(loadingsByTicker.get(ticker)!, latestMomentum))
  const sortedAbs = [...rawScores].map(Math.abs).sort((a, b) => a - b)
  console.log(`rawScore distribution: median=${sortedAbs[Math.floor(sortedAbs.length / 2)].toFixed(3)}, p95=${sortedAbs[Math.floor(sortedAbs.length * 0.95)].toFixed(3)} (used to sanity-check SCALE=${SCALE})`)

  const assetScoreUpdates = kept.map((ticker, idx) => {
    const assetId = assetIdByTicker.get(ticker)
    if (assetId == null) return null
    const loadings = loadingsByTicker.get(ticker)!
    const regimeScore = clamp(SCALE * rawScores[idx], -0.4, 0.4)
    const dominant = loadings.reduce((best, v, i) => (Math.abs(v) > Math.abs(loadings[best]) ? i : best), 0)
    const label = `Factor ${dominant + 1} ${loadings[dominant] >= 0 ? '+' : '-'} tilt, ${regimeScore >= 0 ? '+' : ''}${(regimeScore * 100).toFixed(1)}%`
    return { asset_id: assetId, factor_regime_score: round4(regimeScore), factor_regime_label: label }
  }).filter((r): r is { asset_id: number; factor_regime_score: number; factor_regime_label: string } => r != null)

  // 10. Replace both output tables wholesale - PCA component identity isn't stable across refits
  console.log('Clearing previous factor_model_loadings / factor_model_history...')
  await supabase.from('factor_model_loadings').delete().neq('ticker', '')
  await supabase.from('factor_model_history').delete().gte('date', '1900-01-01')

  const loadingRows = kept.map(ticker => ({
    ticker,
    loadings: Object.fromEntries(loadingsByTicker.get(ticker)!.map((v, i) => [`f${i + 1}`, round4(v)])),
    explained_variance: explainedVariance.map(v => round4(v)),
    fit_start: refDates[0],
    fit_end: refDates[refDates.length - 1],
    computed_at: new Date().toISOString(),
  }))

  console.log('Writing factor_model_loadings...')
  const loadingFailures = await upsertChunked('factor_model_loadings', loadingRows, 'ticker')
  console.log('Writing factor_model_history...')
  const historyFailures = await upsertChunked('factor_model_history', historyRows, 'date,factor_index')
  console.log('Writing asset_scores.factor_regime_score/label...')
  const scoreFailures = await upsertChunked('asset_scores', assetScoreUpdates, 'asset_id')

  console.log(`Done. loadings=${loadingRows.length - loadingFailures}/${loadingRows.length}, history=${historyRows.length - historyFailures}/${historyRows.length}, asset_scores=${assetScoreUpdates.length - scoreFailures}/${assetScoreUpdates.length}`)
}

main()
