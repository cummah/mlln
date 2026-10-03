/**
 * compute-macro-backtest.ts
 *
 * Recomputes backtest_summary_macro from scratch using the SCALED macro model:
 * buy every week (or month), but scale the amount by a modifier (mult = 1 + modifier).
 * Standard and macro legs share the exact same buy dates, so alpha = pure effect of
 * regime-aware sizing.
 *
 * The modifier comes from the PCA statistical factor model computed by
 * scripts/compute-factor-model.ts (factor_model_loadings / factor_model_history) -
 * each asset's exposure to a handful of data-derived factors, dotted with those
 * factors' current momentum z-score. This replaced a hand-typed sector x regime
 * lookup table, which was a guess rather than an estimate. Run compute:factor-model
 * before this script (or after new price data lands) to refresh the inputs.
 *
 * Run with: npx ts-node --project tsconfig.scripts.json scripts/compute-macro-backtest.ts [--limit N] [--ticker XYZ]
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { WeightedBuy, buildBacktestResults, combineModifiers, round2 } from '../lib/macroBacktestEngine'

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

// Same magnitude envelope the old sector matrix used (-0.4 to +0.35), so the swap doesn't
// suddenly change how aggressive the macro leg's sizing looks. Calibrated from the first
// real compute:factor-model run (2026-08-19, 1800 tickers): rawScore p95 = 0.145, so
// SCALE = 0.4 / 0.145 ~= 2.75 puts the 95th percentile right at the clamp bound.
const PCA_SCALE = 2.75
const MODIFIER_CLAMP = 0.4

function dot(a: number[], b: number[]): number {
  return a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0)
}

function getPCAModifier(loadings: number[] | undefined, momentumVector: number[]): number {
  if (!loadings || loadings.length === 0) return 0
  const rawScore = dot(loadings, momentumVector)
  return Math.max(-MODIFIER_CLAMP, Math.min(MODIFIER_CLAMP, PCA_SCALE * rawScore))
}

// EWMA/RiskMetrics volatility (IGARCH(1,1), lambda=0.94 daily decay) - not a fitted GARCH(1,1)
// (that needs per-ticker MLE, which needs an optimizer this codebase doesn't have), but the same
// model family and purpose: a cheap, well-established conditional volatility forecast.
const EWMA_LAMBDA = 0.94
const VOL_MEDIAN_WINDOW = 252
const VOL_RATIO_MIN = 0.3
const VOL_RATIO_MAX = 3
// Calibrated from a 200-ticker sample run (2026-08-19): raw |1/ratio-1| p95 = 0.505,
// so AGGRESSION = 0.3 / 0.505 ~= 0.59 puts the 95th percentile at the clamp bound.
const VOL_AGGRESSION = 0.6
const VOL_BONUS_CLAMP = 0.3

interface VolPoint { volRatio: number; isDip: boolean }

function computeEWMAVol(prices: PriceBar[]): Map<string, VolPoint> {
  const n = prices.length
  const returns: number[] = new Array(n - 1)
  for (let i = 1; i < n; i++) returns[i - 1] = prices[i].close / prices[i - 1].close - 1

  const seedN = Math.min(20, returns.length)
  const seedMean = returns.slice(0, seedN).reduce((a, b) => a + b, 0) / seedN
  let variance = returns.slice(0, seedN).reduce((a, b) => a + (b - seedMean) ** 2, 0) / seedN

  const volSeries: number[] = new Array(returns.length)
  for (let i = 0; i < returns.length; i++) {
    if (i > 0) variance = EWMA_LAMBDA * variance + (1 - EWMA_LAMBDA) * returns[i - 1] * returns[i - 1]
    volSeries[i] = Math.sqrt(variance)
  }

  const result = new Map<string, VolPoint>()
  for (let i = 0; i < returns.length; i++) {
    const windowStart = Math.max(0, i - VOL_MEDIAN_WINDOW + 1)
    const window = volSeries.slice(windowStart, i + 1).slice().sort((a, b) => a - b)
    const median = window[Math.floor(window.length / 2)]
    const volRatio = median > 0 ? volSeries[i] / median : 1
    // returns[i] is prices[i+1] vs prices[i], so it belongs to prices[i+1]'s date
    result.set(prices[i + 1].date, { volRatio, isDip: returns[i] < 0 })
  }
  return result
}

function getVolBonus(point: VolPoint | undefined): number {
  if (!point || !point.isDip) return 0
  const ratio = Math.max(VOL_RATIO_MIN, Math.min(VOL_RATIO_MAX, point.volRatio))
  const raw = VOL_AGGRESSION * (1 / ratio - 1)
  rawVolBonusSamples.push(raw)
  return Math.max(-VOL_BONUS_CLAMP, Math.min(VOL_BONUS_CLAMP, raw))
}
// Temporary (calibration only): pre-clamp raw values, so VOL_AGGRESSION can be picked from the
// true distribution rather than one already flattened by the clamp it's being tuned against.
const rawVolBonusSamples: number[] = []

// Mean reversion via Ornstein-Uhlenbeck. The discretized OU process is exactly an AR(1) model,
// so the reversion speed is recoverable from one OLS regression (deviation[t] on deviation[t-1])
// instead of a numerical MLE fit - no optimizer needed, and the simplification here is exact,
// not an approximation (unlike EWMA standing in for a fitted GARCH).
const MR_TREND_WINDOW = 150
const MR_HALFLIFE_REFERENCE = 20 // days - a half-life this fast or faster gets full confidence
const MR_CONFIDENCE_CAP = 2
const MR_BONUS_CLAMP = 0.3
// Calibrated from a 200-ticker sample run (2026-08-20): raw |z*confidence| p95 = 1.201,
// so AGGRESSION = 0.3 / 1.201 ~= 0.25 puts the 95th percentile at the clamp bound.
const MR_AGGRESSION = 0.27

interface MeanReversionState { zScoreByDate: Map<string, number>; halfLifeDays: number | null }

function computeMeanReversion(prices: PriceBar[]): MeanReversionState {
  const n = prices.length
  const zScoreByDate = new Map<string, number>()
  if (n < MR_TREND_WINDOW + 30) return { zScoreByDate, halfLifeDays: null }

  const logPrice = prices.map(p => Math.log(p.close))

  // Trailing simple moving average of log price as the slow "trend" baseline
  const deviation: number[] = new Array(n).fill(NaN)
  let windowSum = 0
  for (let i = 0; i < n; i++) {
    windowSum += logPrice[i]
    if (i >= MR_TREND_WINDOW) windowSum -= logPrice[i - MR_TREND_WINDOW]
    if (i >= MR_TREND_WINDOW - 1) deviation[i] = logPrice[i] - windowSum / MR_TREND_WINDOW
  }

  const validDeviation = deviation.filter(d => !isNaN(d))
  if (validDeviation.length < 30) return { zScoreByDate, halfLifeDays: null }

  // AR(1) OLS: deviation[t] = a + b * deviation[t-1]
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, cnt = 0
  for (let i = 1; i < validDeviation.length; i++) {
    const x = validDeviation[i - 1], y = validDeviation[i]
    sumX += x; sumY += y; sumXY += x * y; sumXX += x * x; cnt++
  }
  const denom = cnt * sumXX - sumX * sumX
  const b = denom !== 0 ? (cnt * sumXY - sumX * sumY) / denom : 1
  // Only 0 < b < 1 is a valid mean-reverting process; outside that range there's no real signal.
  const halfLifeDays = b > 0 && b < 1 ? Math.log(2) / -Math.log(b) : null

  const mean = validDeviation.reduce((a, v) => a + v, 0) / validDeviation.length
  const variance = validDeviation.reduce((a, v) => a + (v - mean) ** 2, 0) / validDeviation.length
  const std = Math.sqrt(variance)

  if (std > 0) {
    for (let i = 0; i < n; i++) {
      if (!isNaN(deviation[i])) zScoreByDate.set(prices[i].date, deviation[i] / std)
    }
  }

  return { zScoreByDate, halfLifeDays }
}

function getMeanReversionBonus(zScore: number | undefined, halfLifeDays: number | null): number {
  if (zScore === undefined || halfLifeDays === null) return 0
  const confidence = Math.max(0, Math.min(MR_CONFIDENCE_CAP, MR_HALFLIFE_REFERENCE / halfLifeDays))
  // Below trend (negative z) -> positive bonus; above trend -> dampened.
  const raw = MR_AGGRESSION * -zScore * confidence
  rawMRBonusSamples.push(raw)
  return Math.max(-MR_BONUS_CLAMP, Math.min(MR_BONUS_CLAMP, raw))
}
const rawMRBonusSamples: number[] = []

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

// ISO week key (year + week number) so we buy once per calendar week
function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${weekNo}`
}

async function main() {
  const limitArg = process.argv.indexOf('--limit')
  const LIMIT = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : Infinity
  const tickerArg = process.argv.indexOf('--ticker')
  const ONLY_TICKER = tickerArg !== -1 ? process.argv[tickerArg + 1].toUpperCase() : null

  // Load PCA factor loadings once (paginated) - produced by `npm run compute:factor-model`
  let loadingRows: any[] = []
  for (let page = 0; ; page++) {
    const { data } = await supabase
      .from('factor_model_loadings')
      .select('ticker, loadings')
      .range(page * 1000, page * 1000 + 999)
    if (!data || data.length === 0) break
    loadingRows = loadingRows.concat(data as any[])
    if (data.length < 1000) break
  }
  if (loadingRows.length === 0) throw new Error('factor_model_loadings is empty - run `npm run compute:factor-model` first')
  const numFactors = Object.keys(loadingRows[0].loadings).length
  const factorKeys = Array.from({ length: numFactors }, (_, i) => `f${i + 1}`)
  const loadingsMap = new Map<string, number[]>(
    loadingRows.map((r: any) => [r.ticker, factorKeys.map(k => r.loadings[k] ?? 0)])
  )
  console.log(`Factor loadings: ${loadingsMap.size} tickers, ${numFactors} factors`)

  // Load factor momentum history once (paginated); carry last-known vector forward for newer dates
  let historyRaw: any[] = []
  for (let page = 0; ; page++) {
    const { data } = await supabase
      .from('factor_model_history')
      .select('date, factor_index, factor_momentum_zscore')
      .order('date', { ascending: true })
      .range(page * 1000, page * 1000 + 999)
    if (!data || data.length === 0) break
    historyRaw = historyRaw.concat(data as any[])
    if (data.length < 1000) break
  }
  if (historyRaw.length === 0) throw new Error('factor_model_history is empty - run `npm run compute:factor-model` first')

  const momentumByDate = new Map<string, number[]>()
  for (const r of historyRaw as any[]) {
    if (!momentumByDate.has(r.date)) momentumByDate.set(r.date, new Array(numFactors).fill(0))
    momentumByDate.get(r.date)![r.factor_index] = r.factor_momentum_zscore ?? 0
  }
  const momentumDates = Array.from(momentumByDate.keys()).sort()
  console.log(`Factor momentum history: ${momentumDates.length} days, ${momentumDates[0]} → ${momentumDates[momentumDates.length - 1]}`)

  const momentumAt = (date: string): number[] => {
    // binary search for last snapshot <= date; falls back to the earliest vector for dates before history starts
    let lo = 0, hi = momentumDates.length - 1, ans = momentumDates[0]
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (momentumDates[mid] <= date) { ans = momentumDates[mid]; lo = mid + 1 }
      else hi = mid - 1
    }
    return momentumByDate.get(ans)!
  }
  const latestMomentum = momentumByDate.get(momentumDates[momentumDates.length - 1])!

  // Assets + scores (paginated — PostgREST caps at 1000 rows/request)
  let assetRows: any[] = []
  for (let page = 0; ; page++) {
    let assetQuery = supabase
      .from('assets')
      .select('id, ticker, name, sector')
      .eq('is_active', true)
      .order('ticker')
      .range(page * 1000, page * 1000 + 999)
    if (ONLY_TICKER) assetQuery = assetQuery.eq('ticker', ONLY_TICKER)
    const { data } = await assetQuery
    if (!data || data.length === 0) break
    assetRows = assetRows.concat(data)
    if (data.length < 1000) break
  }
  const assets = assetRows.slice(0, LIMIT)
  console.log(`Processing ${assets.length} assets`)

  const { data: scoreRows } = await supabase.from('asset_scores').select('asset_id, dca_suitability_score')
  const scoreMap = new Map<number, number>()
  ;(scoreRows as any[])?.forEach(s => { if (s.dca_suitability_score != null) scoreMap.set(s.asset_id, s.dca_suitability_score) })

  const now = new Date()
  const windowStart = (years: number, months = 0): string => {
    const d = new Date(now)
    if (years) d.setFullYear(d.getFullYear() - years)
    if (months) d.setMonth(d.getMonth() - months)
    return d.toISOString().split('T')[0]
  }
  const WINDOWS = {
    '1m': windowStart(0, 1),
    '3m': windowStart(0, 3),
    '1y': windowStart(1),
    '3y': windowStart(3),
    '5y': windowStart(5),
  }

  const outRows: any[] = []
  const componentRows: any[] = []
  const assetScoreUpdates: any[] = []
  let skippedNoPrices = 0
  // Temporary: calibrate VOL_AGGRESSION from the real distribution, same as PCA_SCALE was.
  const volBonusSamples: number[] = []

  const CONCURRENCY = 8
  for (let i = 0; i < assets.length; i += CONCURRENCY) {
    const batch = assets.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(async (asset: any) => {
      const prices = await fetchPrices(asset.ticker, WINDOWS['5y'])
      if (prices.length < 30) { skippedNoPrices++; return }

      const latestClose = prices[prices.length - 1].close
      const assetLoadings = loadingsMap.get(asset.ticker)
      const volMap = computeEWMAVol(prices)
      const mr = computeMeanReversion(prices)

      // Weekly buys: first trading day of each ISO week. factorModifier/volBonus/meanReversionBonus
      // are kept separate (not combined) so the live macro-backtest API can recombine them per the
      // Factor Tilt / Volatility Timing / Mean Reversion toggles - see lib/macroBacktestEngine.ts.
      const weeklyBuys: WeightedBuy[] = []
      let lastWeek = ''
      for (const p of prices) {
        const wk = isoWeekKey(new Date(p.date + 'T12:00:00Z'))
        if (wk !== lastWeek) {
          lastWeek = wk
          const factorModifier = getPCAModifier(assetLoadings, momentumAt(p.date))
          const volBonus = getVolBonus(volMap.get(p.date))
          const meanReversionBonus = getMeanReversionBonus(mr.zScoreByDate.get(p.date), mr.halfLifeDays)
          if (volBonus !== 0) volBonusSamples.push(volBonus)
          weeklyBuys.push({ date: p.date, close: p.close, factorModifier, volBonus, meanReversionBonus })
        }
      }

      // Monthly buys: first trading day of each calendar month
      const monthlyBuys: WeightedBuy[] = []
      let lastMonth = ''
      for (const p of prices) {
        const mo = p.date.slice(0, 7)
        if (mo !== lastMonth) {
          lastMonth = mo
          const factorModifier = getPCAModifier(assetLoadings, momentumAt(p.date))
          const volBonus = getVolBonus(volMap.get(p.date))
          const meanReversionBonus = getMeanReversionBonus(mr.zScoreByDate.get(p.date), mr.halfLifeDays)
          monthlyBuys.push({ date: p.date, close: p.close, factorModifier, volBonus, meanReversionBonus })
        }
      }

      const currentFactorMod = getPCAModifier(assetLoadings, latestMomentum)
      const currentVolBonus = getVolBonus(volMap.get(prices[prices.length - 1].date))
      const currentMRBonus = getMeanReversionBonus(mr.zScoreByDate.get(prices[prices.length - 1].date), mr.halfLifeDays)
      const currentModifier = combineModifiers(currentFactorMod, currentVolBonus, currentMRBonus)
      const row: any = {
        ticker: asset.ticker,
        name: asset.name,
        sector: asset.sector,
        backtest_start: prices[0].date,
        backtest_start_year: new Date(prices[0].date).getFullYear(),
        dca_suitability_score: scoreMap.get(asset.id) ?? null,
        macro_regime: assetLoadings
          ? `Factor model, current tilt ${currentModifier >= 0 ? '+' : ''}${(currentModifier * 100).toFixed(1)}% (vol ${currentVolBonus > 0 ? 'calm' : currentVolBonus < 0 ? 'elevated' : 'n/a'}, MR ${mr.halfLifeDays !== null ? `${mr.halfLifeDays.toFixed(0)}d half-life` : 'n/a'})`
          : 'No factor data',
        updated_at: new Date().toISOString(),
      }

      // Current EWMA volatility-timing state, surfaced on daily/weekly/monthly pages
      // alongside factor_regime_score/label (written separately by compute-factor-model.ts).
      assetScoreUpdates.push({
        asset_id: asset.id,
        vol_timing_score: round2(currentVolBonus),
        vol_timing_label: currentVolBonus > 0
          ? `Calm dip, +${(currentVolBonus * 100).toFixed(1)}%`
          : currentVolBonus < 0
            ? `Elevated dip, ${(currentVolBonus * 100).toFixed(1)}%`
            : 'No dip today',
        mean_reversion_score: round2(currentMRBonus),
        mean_reversion_label: mr.halfLifeDays === null
          ? 'No reversion pattern'
          : `${currentMRBonus >= 0 ? 'Below' : 'Above'} trend, ${mr.halfLifeDays.toFixed(0)}d half-life, ${currentMRBonus >= 0 ? '+' : ''}${(currentMRBonus * 100).toFixed(1)}%`,
      })

      // "All toggles on" - the same function the live API calls, so this baseline can never
      // drift from what a user sees with Factor Tilt + Volatility Timing + Mean Reversion all enabled.
      const results = buildBacktestResults(weeklyBuys, monthlyBuys, latestClose, { factor: true, vol: true, meanReversion: true })

      for (const win of Object.keys(WINDOWS) as Array<keyof typeof WINDOWS>) {
        const { std, enh } = results.weekly[win]
        row[`std_return_${win}`] = std.returnPct
        row[`enh_return_${win}`] = enh.returnPct
        row[`alpha_${win}`] = round2(enh.returnPct - std.returnPct)
        row[`std_invested_${win}`] = std.invested
        row[`enh_invested_${win}`] = enh.invested
        row[`std_value_${win}`] = std.value
        row[`enh_value_${win}`] = enh.value
        row[`std_purchases_${win}`] = std.purchases
        row[`enh_purchases_${win}`] = enh.purchases

        if (win === '1y' || win === '3y' || win === '5y') {
          row[`std_avg_entry_${win}`] = std.avgEntry
          row[`enh_avg_entry_${win}`] = enh.avgEntry
          row[`std_shares_${win}`] = std.shares
          row[`enh_shares_${win}`] = enh.shares
        }

        const m = results.monthly[win]
        row[`monthly_std_return_${win}`] = m.std.returnPct
        row[`monthly_enh_return_${win}`] = m.enh.returnPct
        row[`monthly_alpha_${win}`] = round2(m.enh.returnPct - m.std.returnPct)
        row[`monthly_std_invested_${win}`] = m.std.invested
        row[`monthly_enh_invested_${win}`] = m.enh.invested
        row[`monthly_std_value_${win}`] = m.std.value
        row[`monthly_enh_value_${win}`] = m.enh.value
        row[`monthly_std_purchases_${win}`] = m.std.purchases
        row[`monthly_enh_purchases_${win}`] = m.enh.purchases
        row[`monthly_skipped_${win}`] = 0
        if (win === '1y' || win === '3y' || win === '5y') {
          row[`monthly_std_avg_entry_${win}`] = m.std.avgEntry
          row[`monthly_enh_avg_entry_${win}`] = m.enh.avgEntry
        }
      }

      outRows.push(row)
      componentRows.push({
        ticker: asset.ticker,
        weekly_buys: weeklyBuys,
        monthly_buys: monthlyBuys,
        latest_close: latestClose,
        updated_at: new Date().toISOString(),
      })
    }))
    process.stdout.write(`\rProcessed ${Math.min(i + CONCURRENCY, assets.length)}/${assets.length}`)
  }
  console.log(`\n${outRows.length} rows computed, ${skippedNoPrices} skipped (insufficient prices)`)

  if (volBonusSamples.length > 0) {
    const sortedAbs = volBonusSamples.map(Math.abs).sort((a, b) => a - b)
    const p = (q: number) => sortedAbs[Math.floor(sortedAbs.length * q)]
    console.log(`volBonus (post-clamp) distribution (${volBonusSamples.length} dip samples, VOL_AGGRESSION=${VOL_AGGRESSION}): median=${p(0.5).toFixed(3)}, p95=${p(0.95).toFixed(3)} (clamp=${VOL_BONUS_CLAMP})`)
  }
  if (rawVolBonusSamples.length > 0) {
    const sortedRawAbs = rawVolBonusSamples.map(Math.abs).sort((a, b) => a - b)
    const pr = (q: number) => sortedRawAbs[Math.floor(sortedRawAbs.length * q)]
    console.log(`raw dip-day |1/ratio-1| distribution at VOL_AGGRESSION=${VOL_AGGRESSION} (${rawVolBonusSamples.length} samples, pre-clamp): median=${pr(0.5).toFixed(3)}, p95=${pr(0.95).toFixed(3)} -> suggested VOL_AGGRESSION = ${(VOL_BONUS_CLAMP / (pr(0.95) || 1) * VOL_AGGRESSION).toFixed(2)}`)
  }
  if (rawMRBonusSamples.length > 0) {
    const sortedMRAbs = rawMRBonusSamples.map(Math.abs).sort((a, b) => a - b)
    const pm = (q: number) => sortedMRAbs[Math.floor(sortedMRAbs.length * q)]
    console.log(`raw mean-reversion |z*confidence| distribution at MR_AGGRESSION=${MR_AGGRESSION} (${rawMRBonusSamples.length} samples, pre-clamp): median=${pm(0.5).toFixed(3)}, p95=${pm(0.95).toFixed(3)} -> suggested MR_AGGRESSION = ${(MR_BONUS_CLAMP / (pm(0.95) || 1) * MR_AGGRESSION).toFixed(2)}`)
  }

  if (ONLY_TICKER && outRows.length === 1) {
    console.log(JSON.stringify(outRows[0], null, 2))
  }

  // Upsert in chunks; on chunk failure retry row-by-row to isolate offenders
  const CHUNK = 100
  let upsertFailures = 0
  for (let i = 0; i < outRows.length; i += CHUNK) {
    const chunk = outRows.slice(i, i + CHUNK)
    const { error } = await supabase.from('backtest_summary_macro').upsert(chunk, { onConflict: 'ticker' })
    if (error) {
      console.warn(`Chunk ${i / CHUNK} failed (${error.message}), retrying row-by-row...`)
      for (const row of chunk) {
        const { error: rowErr } = await supabase.from('backtest_summary_macro').upsert([row], { onConflict: 'ticker' })
        if (rowErr) {
          console.error(`  ✗ ${row.ticker}: ${rowErr.message}`)
          upsertFailures++
        }
      }
    }
  }
  console.log(`✓ backtest_summary_macro repopulated (${outRows.length - upsertFailures} rows, ${upsertFailures} failed)`)

  // Raw per-buy components (factorModifier/volBonus kept separate) for the live
  // Factor Tilt / Volatility Timing toggles on the ticker page - app/api/asset/[ticker]/macro-backtest
  let componentFailures = 0
  for (let i = 0; i < componentRows.length; i += CHUNK) {
    const chunk = componentRows.slice(i, i + CHUNK)
    const { error } = await supabase.from('macro_signal_components').upsert(chunk, { onConflict: 'ticker' })
    if (error) {
      console.warn(`macro_signal_components chunk ${i / CHUNK} failed (${error.message}), retrying row-by-row...`)
      for (const row of chunk) {
        const { error: rowErr } = await supabase.from('macro_signal_components').upsert([row], { onConflict: 'ticker' })
        if (rowErr) {
          console.error(`  ✗ ${row.ticker}: ${rowErr.message}`)
          componentFailures++
        }
      }
    }
  }
  console.log(`✓ macro_signal_components repopulated (${componentRows.length - componentFailures} rows, ${componentFailures} failed)`)

  // Current vol-timing state per asset - surfaced on daily/weekly/monthly pages
  let scoreFailures = 0
  for (let i = 0; i < assetScoreUpdates.length; i += CHUNK) {
    const chunk = assetScoreUpdates.slice(i, i + CHUNK)
    const { error } = await supabase.from('asset_scores').upsert(chunk, { onConflict: 'asset_id' })
    if (error) {
      console.warn(`asset_scores chunk ${i / CHUNK} failed (${error.message}), retrying row-by-row...`)
      for (const row of chunk) {
        const { error: rowErr } = await supabase.from('asset_scores').upsert([row], { onConflict: 'asset_id' })
        if (rowErr) {
          console.error(`  ✗ asset_id ${row.asset_id}: ${rowErr.message}`)
          scoreFailures++
        }
      }
    }
  }
  console.log(`✓ asset_scores.vol_timing_score/mean_reversion_score updated (${assetScoreUpdates.length - scoreFailures} rows, ${scoreFailures} failed)`)

  // Quick sanity summary
  const alphas = outRows.map(r => r.alpha_5y).filter((a: number) => a !== 0)
  console.log(`Assets with non-zero 5y alpha: ${alphas.length}/${outRows.length}`)
}

main()
