import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { runTVEnhancedDCA, PriceBar } from '../lib/dcaEngine'

// Load .env.local so Supabase keys are available
const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

interface BacktestSignalsRow {
  ticker: string
  signals_5y_weekly: any
  current_signal_5y_weekly: any
  signals_5y_monthly: any
  current_signal_5y_monthly: any
  updated_at: string
}

interface SectorStatsRow {
  sector: string
  total_assets: number
  avg_rsi: number
  assets_in_buy_zone: number
  sector_return_1m: number
  sector_return_3m: number
  sector_return_1y: number
  updated_at: string
}

interface BacktestSummaryRow {
  ticker: string
  name: string
  sector: string
  backtest_start: string

  // 1M data
  std_return_1m: number
  enh_return_1m: number
  alpha_1m: number
  std_invested_1m: number
  enh_invested_1m: number
  std_value_1m: number
  enh_value_1m: number
  std_purchases_1m: number
  enh_purchases_1m: number

  monthly_std_return_1m: number
  monthly_enh_return_1m: number
  monthly_alpha_1m: number
  monthly_std_invested_1m: number
  monthly_enh_invested_1m: number
  monthly_std_value_1m: number
  monthly_enh_value_1m: number

  // 3M data
  std_return_3m: number
  enh_return_3m: number
  alpha_3m: number
  std_invested_3m: number
  enh_invested_3m: number
  std_value_3m: number
  enh_value_3m: number
  std_purchases_3m: number
  enh_purchases_3m: number

  monthly_std_return_3m: number
  monthly_enh_return_3m: number
  monthly_alpha_3m: number
  monthly_std_invested_3m: number
  monthly_enh_invested_3m: number
  monthly_std_value_3m: number
  monthly_enh_value_3m: number

  // 1Y data
  std_return_1y: number
  enh_return_1y: number
  alpha_1y: number
  std_invested_1y: number
  enh_invested_1y: number
  std_value_1y: number
  enh_value_1y: number
  std_purchases_1y: number
  enh_purchases_1y: number
  std_avg_entry_1y: number
  enh_avg_entry_1y: number
  std_shares_1y: number
  enh_shares_1y: number

  monthly_std_return_1y: number
  monthly_enh_return_1y: number
  monthly_alpha_1y: number
  monthly_std_invested_1y: number
  monthly_enh_invested_1y: number
  monthly_std_value_1y: number
  monthly_enh_value_1y: number

  // 3Y data
  std_return_3y: number
  enh_return_3y: number
  alpha_3y: number
  std_invested_3y: number
  enh_invested_3y: number
  std_value_3y: number
  enh_value_3y: number
  std_purchases_3y: number
  enh_purchases_3y: number
  std_avg_entry_3y: number
  enh_avg_entry_3y: number
  std_shares_3y: number
  enh_shares_3y: number

  monthly_std_return_3y: number
  monthly_enh_return_3y: number
  monthly_alpha_3y: number
  monthly_std_invested_3y: number
  monthly_enh_invested_3y: number
  monthly_std_value_3y: number
  monthly_enh_value_3y: number

  // 5Y data
  std_return_5y: number
  enh_return_5y: number
  alpha_5y: number
  std_invested_5y: number
  enh_invested_5y: number
  std_value_5y: number
  enh_value_5y: number
  std_purchases_5y: number
  enh_purchases_5y: number
  std_avg_entry_5y: number
  enh_avg_entry_5y: number
  std_shares_5y: number
  enh_shares_5y: number

  monthly_std_return_5y: number
  monthly_enh_return_5y: number
  monthly_alpha_5y: number
  monthly_std_invested_5y: number
  monthly_enh_invested_5y: number
  monthly_std_value_5y: number
  monthly_enh_value_5y: number

  updated_at: string
}

interface WindowResult {
  std: {
    netProfitPct: number
    totalInvested: number
    currentValue: number
    avgEntry: number
    totalShares: number
  }
  enh: {
    netProfitPct: number
    totalInvested: number
    currentValue: number
    avgEntry: number
    totalShares: number
  }
  purchases: {
    std: number
    enh: number
  }
  alpha: number
}

async function run5YSignalsForStorage(
  allBars: PriceBar[],
): Promise<{
  weekly: { signals: any[]; currentSignal: any }
  monthly: { signals: any[]; currentSignal: any }
} | null> {
  try {
    if (allBars.length < 250) return null

    // Get 5Y slice
    const lastDate = new Date(allBars[allBars.length - 1].date)
    const cutoffDate = new Date(lastDate)
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 5)
    const cutoffStr = cutoffDate.toISOString().slice(0, 10)

    const cutoffIndex = allBars.findIndex(b => b.date >= cutoffStr)
    if (cutoffIndex === -1) return null

    const warmupStart = Math.max(0, cutoffIndex - 250)
    const windowBars = allBars.slice(warmupStart)

    if (windowBars.length < 250) return null

    // Enhanced DCA config (shared)
    const enhConfig = {
      slippage: 0.05,
      rsiLevel1: 35,
      rsiLevel2: 45,
      rsiLevel3: 50,
      rsiLevel4: 55,
      buyPercent1: 400,
      buyPercent2: 150,
      buyPercent3: 50,
      buyPercent4: 0,
      buyPercent5: 0,
      adxPeriod: 14,
      adxThreshold: 25,
      trendPenalty: 0.5,
      onlyPenalizeDowntrends: true,
      drawdownAggression: 2.0,
      maxDrawdownBonus: 2.0,
      drawdownLookback: 252,
      extremeDrawdownOverride: true,
      extremeDrawdownThreshold: 20,
      emaLength: 200,
      emaMaxPct: 15.0,
      emaBelowMaxMult: 2.0,
      emaAboveMinMult: 0.0,
      useVIX: true,
      vixThreshold: 25,
      vixBonusMultiplier: 1.5,
      vixRSICombo: true,
      maxTotalMultiplier: 6.0,
    }

    // Weekly signals
    const weeklyResult = runTVEnhancedDCA(windowBars, {
      ...enhConfig,
      baseAmount: 100,
      frequency: 'weekly',
      rsiLength: 7,
    })

    const weeklySignals = computeExitSignals(
      weeklyResult.backtest?.debugDCADays || [],
      windowBars,
      { rsiLevel3: enhConfig.rsiLevel3, rsiLevel4: enhConfig.rsiLevel4 }
    )
    const weeklyCurrentSignal = weeklyResult.signal || {
      amount: 0,
      strength: 'neutral',
      mult: 1,
      reasoning: '',
    }

    // Monthly signals
    const monthlyResult = runTVEnhancedDCA(windowBars, {
      ...enhConfig,
      baseAmount: 433,
      frequency: 'monthly',
      rsiLength: 14,
    })

    const monthlySignals = computeExitSignals(
      monthlyResult.backtest?.debugDCADays || [],
      windowBars,
      { rsiLevel3: enhConfig.rsiLevel3, rsiLevel4: enhConfig.rsiLevel4 }
    )
    const monthlyCurrentSignal = monthlyResult.signal || {
      amount: 0,
      strength: 'neutral',
      mult: 1,
      reasoning: '',
    }

    return {
      weekly: { signals: weeklySignals, currentSignal: weeklyCurrentSignal },
      monthly: { signals: monthlySignals, currentSignal: monthlyCurrentSignal },
    }
  } catch (err) {
    console.error('Error running 5Y signals:', err)
    return null
  }
}

function computeExitScore(dayData: any, config: { rsiLevel3: number; rsiLevel4: number }): number {
  const rsi = dayData.rsi ?? 50;
  const emaMult = dayData.emaMult ?? 1.0;
  const regimeAdj = dayData.regimeAdj ?? 1.0;
  const ddBonus = dayData.ddBonus ?? 1.0;
  const vixBonus = dayData.vixBonus ?? 1.0;

  // RSI: exit when RSI above rsiLevel4 (no-buy zone for daily = 65)
  const exitRsiMult = rsi > config.rsiLevel4 ? 2.0 : rsi > config.rsiLevel3 ? 1.0 : 0.0;

  // EMA: exit when price back above EMA (emaMult < 1.0 means price >= EMA)
  const exitEmaMult = emaMult < 0.8 ? 2.0 : emaMult <= 1.0 ? 1.0 : 0.0;

  // Regime: no penalty = favorable for exit (uptrend or ranging)
  const exitRegime = regimeAdj >= 1.0 ? 1.5 : 0.8;

  // Drawdown: recovered (ddBonus < 1.1 means minimal drawdown)
  const exitDd = ddBonus < 1.1 ? 1.5 : 1.0;

  // VIX: calm (vixBonus = 1.0 means VIX not elevated)
  const exitVix = vixBonus <= 1.0 ? 1.3 : 0.8;

  return exitRsiMult * exitEmaMult * exitRegime * exitDd * exitVix;
}

function computeExitSignals(debugDCADays: any[], bars: PriceBar[], config?: { rsiLevel3: number; rsiLevel4: number }): any[] {
  const EXIT_THRESHOLD = 2.0;

  // Default to daily config if not provided
  const finalConfig = config || { rsiLevel3: 55, rsiLevel4: 65 };

  // Build maps for fast lookup
  const barsByDate = new Map<string, PriceBar>();
  const daysByDate = new Map<string, any>();

  for (const bar of bars) {
    barsByDate.set(bar.date, bar);
  }

  for (const day of debugDCADays) {
    daysByDate.set(day.date, day);
  }

  // Annotate each day with exit data
  const annotatedDays = debugDCADays.map((day: any, idx: number) => {
    // Skip non-buy days — they get exitOpen = false, exitDate/Return = null
    if (day.isSkipped === true) {
      return {
        ...day,
        exitDate: null,
        exitReturn: null,
        exitScore: null,
        exitOpen: false,
      };
    }

    const entryBar = barsByDate.get(day.date);
    if (!entryBar) {
      return {
        ...day,
        exitDate: null,
        exitReturn: null,
        exitScore: null,
        exitOpen: true,
      };
    }

    // Scan forward from next day looking for exit signal
    const config = finalConfig;

    for (let i = idx + 1; i < debugDCADays.length; i++) {
      const scanDay = debugDCADays[i];
      const exitScore = computeExitScore(scanDay, config);

      if (exitScore >= EXIT_THRESHOLD) {
        const exitBar = barsByDate.get(scanDay.date);
        if (exitBar) {
          const exitReturn = ((exitBar.close / entryBar.close - 1) * 100);
          return {
            ...day,
            exitDate: scanDay.date,
            exitReturn: Math.round(exitReturn * 100) / 100,
            exitScore: Math.round(exitScore * 100) / 100,
            exitOpen: false,
          };
        }
      }
    }

    // No exit found — trade is still open
    return {
      ...day,
      exitDate: null,
      exitReturn: null,
      exitScore: null,
      exitOpen: true,
    };
  });

  return annotatedDays;
}

async function run1YDailySignalsForStorage(
  allBars: PriceBar[],
): Promise<{
  signals: any[]
  currentSignal: any
} | null> {
  try {
    if (allBars.length < 250) return null

    // Get 1Y slice
    const lastDate = new Date(allBars[allBars.length - 1].date)
    const cutoffDate = new Date(lastDate)
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 1)
    const cutoffStr = cutoffDate.toISOString().slice(0, 10)

    const cutoffIndex = allBars.findIndex(b => b.date >= cutoffStr)
    if (cutoffIndex === -1) return null

    const warmupStart = Math.max(0, cutoffIndex - 250)
    const windowBars = allBars.slice(warmupStart)

    if (windowBars.length < 250) return null

    // Enhanced DCA config (shared)
    const enhConfig = {
      slippage: 0.05,
      rsiLevel1: 35,
      rsiLevel2: 45,
      rsiLevel3: 50,
      rsiLevel4: 55,
      buyPercent1: 400,
      buyPercent2: 150,
      buyPercent3: 50,
      buyPercent4: 0,
      buyPercent5: 0,
      adxPeriod: 14,
      adxThreshold: 25,
      trendPenalty: 0.5,
      onlyPenalizeDowntrends: true,
      drawdownAggression: 2.0,
      maxDrawdownBonus: 2.0,
      drawdownLookback: 252,
      extremeDrawdownOverride: true,
      extremeDrawdownThreshold: 20,
      emaLength: 200,
      emaMaxPct: 15.0,
      emaBelowMaxMult: 2.0,
      emaAboveMinMult: 0.0,
      useVIX: true,
      vixThreshold: 25,
      vixBonusMultiplier: 1.5,
      vixRSICombo: true,
      maxTotalMultiplier: 6.0,
    }

    // Daily signals (adjusted RSI thresholds and EMA period for daily volatility)
    const dailyResult = runTVEnhancedDCA(windowBars, {
      ...enhConfig,
      baseAmount: 100,
      frequency: 'daily',
      rsiLength: 5,
      rsiLevel1: 35,    // 4.0x strong buy
      rsiLevel2: 45,    // 1.5x moderate buy
      rsiLevel3: 55,    // 0.5x weak buy (vs 50 for weekly)
      rsiLevel4: 65,    // skip above 65 (vs 55 for weekly)
      emaLength: 14,    // Use 14-period EMA for daily (vs 200 for weekly/monthly)
    })

    const dailySignals = dailyResult.backtest?.debugDCADays || []
    const annotatedSignals = computeExitSignals(dailySignals, windowBars)
    const dailyCurrentSignal = dailyResult.signal || {
      amount: 0,
      strength: 'neutral',
      mult: 1,
      reasoning: '',
    }

    return {
      signals: annotatedSignals,
      currentSignal: dailyCurrentSignal,
    }
  } catch (err) {
    console.error('Error running 1Y daily signals:', err)
    return null
  }
}

async function computeSectorStats(
  supabase: any,
  allAssets: any[]
): Promise<SectorStatsRow[]> {
  try {
    const sectorStatsMap = new Map<string, any>()

    // Initialize stats for all sectors
    for (const asset of allAssets) {
      const sector = asset.sector || 'Unknown'
      if (!sectorStatsMap.has(sector)) {
        sectorStatsMap.set(sector, {
          total_assets: 0,
          enhReturns1m: [] as number[],
          enhReturns3m: [] as number[],
          enhReturns1y: [] as number[],
          assetsInBuyZone: 0,
        })
      }
      sectorStatsMap.get(sector).total_assets++
    }

    // Fetch backtest_summary data for all tickers (including 1M, 3M returns)
    const { data: backtestData } = await supabase
      .from('backtest_summary')
      .select('ticker, sector, enh_return_1m, enh_return_3m, enh_return_1y')
      .in('ticker', allAssets.map((a: any) => a.ticker))

    if (!backtestData || backtestData.length === 0) {
      console.warn('No backtest data found for sector stats, using placeholder values')
      const sectorStats: SectorStatsRow[] = []
      for (const [sector, stats] of Array.from(sectorStatsMap.entries())) {
        sectorStats.push({
          sector,
          total_assets: stats.total_assets,
          avg_rsi: 50,
          assets_in_buy_zone: 0,
          sector_return_1m: 0,
          sector_return_3m: 0,
          sector_return_1y: 0,
          updated_at: new Date().toISOString(),
        })
      }
      return sectorStats
    }

    // Build backtest data map and aggregate returns by sector
    const backtestByTicker: Record<string, any> = {}
    backtestData.forEach((row: any) => {
      backtestByTicker[row.ticker] = row
    })

    // Aggregate DCA returns by sector
    for (const asset of allAssets) {
      const sector = asset.sector || 'Unknown'
      const stats = sectorStatsMap.get(sector)
      const btData = backtestByTicker[asset.ticker]

      if (btData) {
        if (btData.enh_return_1m != null) stats.enhReturns1m.push(btData.enh_return_1m)
        if (btData.enh_return_3m != null) stats.enhReturns3m.push(btData.enh_return_3m)
        if (btData.enh_return_1y != null) stats.enhReturns1y.push(btData.enh_return_1y)
      }
    }

    // Fetch backtest_signals to count assets with active buy signals
    const { data: signalsData } = await supabase
      .from('backtest_signals')
      .select('ticker, current_signal_5y_weekly')
      .in('ticker', allAssets.map((a: any) => a.ticker))

    const signalsByTicker: Record<string, any> = {}
    if (signalsData) {
      signalsData.forEach((row: any) => {
        signalsByTicker[row.ticker] = row.current_signal_5y_weekly
      })
    }

    // Count assets in buy zone per sector
    for (const asset of allAssets) {
      const sector = asset.sector || 'Unknown'
      const stats = sectorStatsMap.get(sector)
      const signal = signalsByTicker[asset.ticker]

      if (signal && typeof signal === 'object' && (signal.finalMultiplier ?? 0) > 1.0) {
        stats.assetsInBuyZone++
      }
    }

    // Build final sector stats
    const avg = (arr: number[]) =>
      arr.length > 0
        ? Math.round((arr.reduce((a: number, b: number) => a + b, 0) / arr.length) * 100) / 100
        : 0

    const sectorStats: SectorStatsRow[] = []
    for (const [sector, stats] of Array.from(sectorStatsMap.entries())) {
      sectorStats.push({
        sector,
        total_assets: stats.total_assets,
        avg_rsi: 50,  // Neutral default; no longer computed from daily RSI
        assets_in_buy_zone: stats.assetsInBuyZone,
        sector_return_1m: avg(stats.enhReturns1m),
        sector_return_3m: avg(stats.enhReturns3m),
        sector_return_1y: avg(stats.enhReturns1y),
        updated_at: new Date().toISOString(),
      })
    }

    return sectorStats
  } catch (err) {
    console.error('Error computing sector stats:', err)
    return []
  }
}

async function runBacktestForWindow(
  allBars: PriceBar[],
  months: number | null,
  years: number | null = null
): Promise<WindowResult | null> {
  try {
    if (allBars.length < 250) return null

    // Slice to the requested window using calendar date
    const lastDate = new Date(allBars[allBars.length - 1].date)
    const cutoffDate = new Date(lastDate)

    if (years !== null) {
      cutoffDate.setFullYear(cutoffDate.getFullYear() - years)
    } else if (months !== null) {
      cutoffDate.setMonth(cutoffDate.getMonth() - months)
    } else {
      return null
    }

    const cutoffStr = cutoffDate.toISOString().slice(0, 10)

    // Filter by date, but keep 250 bars before for warmup
    const cutoffIndex = allBars.findIndex(b => b.date >= cutoffStr)
    if (cutoffIndex === -1) return null

    const warmupStart = Math.max(0, cutoffIndex - 250)
    const windowBars = allBars.slice(warmupStart)

    if (windowBars.length < 250) return null

    // Enhanced DCA with both standard (1.0x multiplier) and enhanced strategies
    const result = runTVEnhancedDCA(windowBars, {
      baseAmount: 100,
      frequency: 'weekly',
      slippage: 0.05,
      rsiLength: 7,
      rsiLevel1: 35,
      rsiLevel2: 45,
      rsiLevel3: 50,
      rsiLevel4: 55,
      buyPercent1: 400,
      buyPercent2: 150,
      buyPercent3: 50,
      buyPercent4: 0,
      buyPercent5: 0,
      adxPeriod: 14,
      adxThreshold: 25,
      trendPenalty: 0.5,
      onlyPenalizeDowntrends: true,
      drawdownAggression: 2.0,
      maxDrawdownBonus: 2.0,
      drawdownLookback: 252,
      extremeDrawdownOverride: true,
      extremeDrawdownThreshold: 20,
      emaLength: 200,
      emaMaxPct: 15.0,
      emaBelowMaxMult: 2.0,
      emaAboveMinMult: 0.0,
      useVIX: true,
      vixThreshold: 25,
      vixBonusMultiplier: 1.5,
      vixRSICombo: true,
      maxTotalMultiplier: 6.0,
    })

    // Count purchases
    let stdPurchases = result.backtest.purchases.std
    let enhPurchases = result.backtest.purchases.enh

    return {
      std: result.backtest.std,
      enh: result.backtest.enh,
      purchases: {
        std: stdPurchases,
        enh: enhPurchases,
      },
      alpha: result.backtest.alpha,
    }
  } catch (err) {
    console.error(`Error running backtest for ${years}Y:`, err)
    return null
  }
}

async function runMonthlyBacktestForWindow(
  allBars: PriceBar[],
  months: number | null,
  years: number | null = null
): Promise<WindowResult | null> {
  try {
    if (allBars.length < 250) return null

    // Slice to the requested window using calendar date
    const lastDate = new Date(allBars[allBars.length - 1].date)
    const cutoffDate = new Date(lastDate)

    if (years !== null) {
      cutoffDate.setFullYear(cutoffDate.getFullYear() - years)
    } else if (months !== null) {
      cutoffDate.setMonth(cutoffDate.getMonth() - months)
    } else {
      return null
    }

    const cutoffStr = cutoffDate.toISOString().slice(0, 10)

    // Filter by date, but keep 250 bars before for warmup
    const cutoffIndex = allBars.findIndex(b => b.date >= cutoffStr)
    if (cutoffIndex === -1) return null

    const warmupStart = Math.max(0, cutoffIndex - 250)
    const windowBars = allBars.slice(warmupStart)

    if (windowBars.length < 250) return null

    // Enhanced DCA with both standard (1.0x multiplier) and enhanced strategies
    const result = runTVEnhancedDCA(windowBars, {
      baseAmount: 433,
      frequency: 'monthly',
      slippage: 0.05,
      rsiLength: 14,
      rsiLevel1: 35,
      rsiLevel2: 45,
      rsiLevel3: 50,
      rsiLevel4: 55,
      buyPercent1: 400,
      buyPercent2: 150,
      buyPercent3: 50,
      buyPercent4: 0,
      buyPercent5: 0,
      adxPeriod: 14,
      adxThreshold: 25,
      trendPenalty: 0.5,
      onlyPenalizeDowntrends: true,
      drawdownAggression: 2.0,
      maxDrawdownBonus: 2.0,
      drawdownLookback: 252,
      extremeDrawdownOverride: true,
      extremeDrawdownThreshold: 20,
      emaLength: 200,
      emaMaxPct: 15.0,
      emaBelowMaxMult: 2.0,
      emaAboveMinMult: 0.0,
      useVIX: true,
      vixThreshold: 25,
      vixBonusMultiplier: 1.5,
      vixRSICombo: true,
      maxTotalMultiplier: 6.0,
    })

    // Count purchases
    let stdPurchases = result.backtest.purchases.std
    let enhPurchases = result.backtest.purchases.enh

    return {
      std: result.backtest.std,
      enh: result.backtest.enh,
      purchases: {
        std: stdPurchases,
        enh: enhPurchases,
      },
      alpha: result.backtest.alpha,
    }
  } catch (err) {
    console.error(`Error running monthly backtest for ${years}Y:`, err)
    return null
  }
}

async function main() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    console.log('==========================================')
    console.log('   Compute Backtest Summary (Weekly + Monthly DCA)')
    console.log('   For all assets across 1Y/3Y/5Y')
    console.log('==========================================\n')

    // 1. Fetch all active assets with pagination
    console.log('Fetching active assets...')
    const allAssets: any[] = []
    const pageSize = 1000
    for (let page = 0; ; page++) {
      const { data: assets, error: assetsError } = await supabase
        .from('assets')
        .select('ticker, name, sector')
        .eq('is_active', true)
        .range(page * pageSize, page * pageSize + pageSize - 1)

      if (assetsError || !assets) {
        console.error('Error fetching assets:', assetsError)
        process.exit(1)
      }
      allAssets.push(...assets)
      if (assets.length < pageSize) break
    }

    console.log(`Found ${allAssets.length} active assets\n`)

    let processedCount = 0
    let successCount = 0
    let failureCount = 0
    const startTime = Date.now()
    const rowsToUpsert: BacktestSummaryRow[] = []
    const signalsToUpsert: BacktestSignalsRow[] = []
    const dailySignalsToUpsert: any[] = []

    // 1a. Fetch VIX data once (instead of for each asset)
    console.log('Pre-fetching VIX data...')
    let vixDataCache = new Map<string, number>()
    try {
      let vixPrices: any[] = []
      let vixPage = 0
      const pageSize = 1000
      while (true) {
        const { data: vixData } = await supabase
          .from('daily_prices')
          .select('date, close')
          .eq('ticker', '^VIX')
          .order('date', { ascending: true })
          .range(vixPage * pageSize, (vixPage + 1) * pageSize - 1)
        if (!vixData || vixData.length === 0) break
        vixPrices = vixPrices.concat(vixData)
        if (vixData.length < pageSize) break
        vixPage++
      }
      vixDataCache = new Map(vixPrices.map(v => [v.date, Number(v.close)]))
      console.log(`Cached ${vixDataCache.size} VIX data points\n`)
    } catch (err) {
      console.warn('Warning: Could not pre-fetch VIX data, will fetch per-asset')
    }

    // 2. Process each asset
    for (const asset of allAssets) {
      try {
        // Fetch all price data for this ticker
        let allPrices: any[] = []
        let page = 0
        const pageSize = 1000

        while (true) {
          const { data: pageData, error: pageError } = await supabase
            .from('daily_prices')
            .select('date, open, high, low, close, volume')
            .eq('ticker', asset.ticker)
            .order('date', { ascending: true })
            .range(page * pageSize, (page + 1) * pageSize - 1)

          if (pageError) break
          if (!pageData || pageData.length === 0) break

          allPrices = allPrices.concat(pageData)
          if (pageData.length < pageSize) break
          page++
        }

        // Minimum bars to get at least 1Y data
        if (allPrices.length < 300) {
          failureCount++
          processedCount++
          console.log(`Skip: ${asset.ticker} (${allPrices.length} prices - insufficient)`)
          continue
        }

        // Use pre-fetched VIX cache
        const vixMap = vixDataCache

        console.log(`Process: ${asset.ticker} (${allPrices.length} prices)`)

        // Convert to PriceBar format
        const bars: PriceBar[] = allPrices.map(p => ({
          date: p.date,
          open: Number(p.open),
          high: Number(p.high),
          low: Number(p.low),
          close: Number(p.close),
          volume: Number(p.volume),
          vix: vixMap.get(p.date),
        }))

        // Run backtests for each window (1M, 3M, 1Y, 3Y, 5Y) × (weekly, monthly)
        const windows = [
          { label: '1m', months: 1 },
          { label: '3m', months: 3 },
          { label: '1y', years: 1 },
          { label: '3y', years: 3 },
          { label: '5y', years: 5 },
        ]

        const windowResults: Record<string, any> = {}

        for (const window of windows) {
          const months = (window as any).months || null
          const years = (window as any).years || null
          const weeklyResult = await runBacktestForWindow(bars, months, years)
          const monthlyResult = await runMonthlyBacktestForWindow(bars, months, years)
          if (weeklyResult || monthlyResult) {
            windowResults[window.label] = {
              weekly: weeklyResult,
              monthly: monthlyResult,
            }
          }
        }

        // Process if we got at least 1Y weekly data
        if (!windowResults['1y']?.weekly) {
          failureCount++
          processedCount++
          console.log(`Skip: ${asset.ticker} (no valid windows)`)
          continue
        }

        // Log what we got
        const windowStr = Object.keys(windowResults).join(', ')
        console.log(`  Windows available: ${windowStr}`)

        // Helper to get nested values
        const getFieldNum = (obj: any, path: string[]): number => {
          let current = obj
          for (const key of path) {
            current = current?.[key]
          }
          return typeof current === 'number' ? current : 0
        }

        // Build row with all data
        const row: BacktestSummaryRow = {
          ticker: asset.ticker,
          name: asset.name,
          sector: asset.sector || '',
          backtest_start: bars[0]?.date || '2020-01-01',

          // 1M Weekly
          std_return_1m: getFieldNum(windowResults['1m']?.weekly, ['std', 'netProfitPct']),
          enh_return_1m: getFieldNum(windowResults['1m']?.weekly, ['enh', 'netProfitPct']),
          alpha_1m: windowResults['1m']?.weekly?.alpha || 0,
          std_invested_1m: getFieldNum(windowResults['1m']?.weekly, ['std', 'totalInvested']),
          enh_invested_1m: getFieldNum(windowResults['1m']?.weekly, ['enh', 'totalInvested']),
          std_value_1m: getFieldNum(windowResults['1m']?.weekly, ['std', 'currentValue']),
          enh_value_1m: getFieldNum(windowResults['1m']?.weekly, ['enh', 'currentValue']),
          std_purchases_1m: windowResults['1m']?.weekly?.purchases?.std || 0,
          enh_purchases_1m: windowResults['1m']?.weekly?.purchases?.enh || 0,

          // 1M Monthly
          monthly_std_return_1m: getFieldNum(windowResults['1m']?.monthly, ['std', 'netProfitPct']),
          monthly_enh_return_1m: getFieldNum(windowResults['1m']?.monthly, ['enh', 'netProfitPct']),
          monthly_alpha_1m: windowResults['1m']?.monthly?.alpha || 0,
          monthly_std_invested_1m: getFieldNum(windowResults['1m']?.monthly, ['std', 'totalInvested']),
          monthly_enh_invested_1m: getFieldNum(windowResults['1m']?.monthly, ['enh', 'totalInvested']),
          monthly_std_value_1m: getFieldNum(windowResults['1m']?.monthly, ['std', 'currentValue']),
          monthly_enh_value_1m: getFieldNum(windowResults['1m']?.monthly, ['enh', 'currentValue']),

          // 3M Weekly
          std_return_3m: getFieldNum(windowResults['3m']?.weekly, ['std', 'netProfitPct']),
          enh_return_3m: getFieldNum(windowResults['3m']?.weekly, ['enh', 'netProfitPct']),
          alpha_3m: windowResults['3m']?.weekly?.alpha || 0,
          std_invested_3m: getFieldNum(windowResults['3m']?.weekly, ['std', 'totalInvested']),
          enh_invested_3m: getFieldNum(windowResults['3m']?.weekly, ['enh', 'totalInvested']),
          std_value_3m: getFieldNum(windowResults['3m']?.weekly, ['std', 'currentValue']),
          enh_value_3m: getFieldNum(windowResults['3m']?.weekly, ['enh', 'currentValue']),
          std_purchases_3m: windowResults['3m']?.weekly?.purchases?.std || 0,
          enh_purchases_3m: windowResults['3m']?.weekly?.purchases?.enh || 0,

          // 3M Monthly
          monthly_std_return_3m: getFieldNum(windowResults['3m']?.monthly, ['std', 'netProfitPct']),
          monthly_enh_return_3m: getFieldNum(windowResults['3m']?.monthly, ['enh', 'netProfitPct']),
          monthly_alpha_3m: windowResults['3m']?.monthly?.alpha || 0,
          monthly_std_invested_3m: getFieldNum(windowResults['3m']?.monthly, ['std', 'totalInvested']),
          monthly_enh_invested_3m: getFieldNum(windowResults['3m']?.monthly, ['enh', 'totalInvested']),
          monthly_std_value_3m: getFieldNum(windowResults['3m']?.monthly, ['std', 'currentValue']),
          monthly_enh_value_3m: getFieldNum(windowResults['3m']?.monthly, ['enh', 'currentValue']),

          // 1Y Weekly
          std_return_1y: getFieldNum(windowResults['1y']?.weekly, ['std', 'netProfitPct']),
          enh_return_1y: getFieldNum(windowResults['1y']?.weekly, ['enh', 'netProfitPct']),
          alpha_1y: windowResults['1y']?.weekly?.alpha || 0,
          std_invested_1y: getFieldNum(windowResults['1y']?.weekly, ['std', 'totalInvested']),
          enh_invested_1y: getFieldNum(windowResults['1y']?.weekly, ['enh', 'totalInvested']),
          std_value_1y: getFieldNum(windowResults['1y']?.weekly, ['std', 'currentValue']),
          enh_value_1y: getFieldNum(windowResults['1y']?.weekly, ['enh', 'currentValue']),
          std_purchases_1y: windowResults['1y']?.weekly?.purchases?.std || 0,
          enh_purchases_1y: windowResults['1y']?.weekly?.purchases?.enh || 0,
          std_avg_entry_1y: getFieldNum(windowResults['1y']?.weekly, ['std', 'avgEntry']),
          enh_avg_entry_1y: getFieldNum(windowResults['1y']?.weekly, ['enh', 'avgEntry']),
          std_shares_1y: getFieldNum(windowResults['1y']?.weekly, ['std', 'totalShares']),
          enh_shares_1y: getFieldNum(windowResults['1y']?.weekly, ['enh', 'totalShares']),

          // 1Y Monthly
          monthly_std_return_1y: getFieldNum(windowResults['1y']?.monthly, ['std', 'netProfitPct']),
          monthly_enh_return_1y: getFieldNum(windowResults['1y']?.monthly, ['enh', 'netProfitPct']),
          monthly_alpha_1y: windowResults['1y']?.monthly?.alpha || 0,
          monthly_std_invested_1y: getFieldNum(windowResults['1y']?.monthly, ['std', 'totalInvested']),
          monthly_enh_invested_1y: getFieldNum(windowResults['1y']?.monthly, ['enh', 'totalInvested']),
          monthly_std_value_1y: getFieldNum(windowResults['1y']?.monthly, ['std', 'currentValue']),
          monthly_enh_value_1y: getFieldNum(windowResults['1y']?.monthly, ['enh', 'currentValue']),

          // 3Y Weekly
          std_return_3y: getFieldNum(windowResults['3y']?.weekly, ['std', 'netProfitPct']),
          enh_return_3y: getFieldNum(windowResults['3y']?.weekly, ['enh', 'netProfitPct']),
          alpha_3y: windowResults['3y']?.weekly?.alpha || 0,
          std_invested_3y: getFieldNum(windowResults['3y']?.weekly, ['std', 'totalInvested']),
          enh_invested_3y: getFieldNum(windowResults['3y']?.weekly, ['enh', 'totalInvested']),
          std_value_3y: getFieldNum(windowResults['3y']?.weekly, ['std', 'currentValue']),
          enh_value_3y: getFieldNum(windowResults['3y']?.weekly, ['enh', 'currentValue']),
          std_purchases_3y: windowResults['3y']?.weekly?.purchases?.std || 0,
          enh_purchases_3y: windowResults['3y']?.weekly?.purchases?.enh || 0,
          std_avg_entry_3y: getFieldNum(windowResults['3y']?.weekly, ['std', 'avgEntry']),
          enh_avg_entry_3y: getFieldNum(windowResults['3y']?.weekly, ['enh', 'avgEntry']),
          std_shares_3y: getFieldNum(windowResults['3y']?.weekly, ['std', 'totalShares']),
          enh_shares_3y: getFieldNum(windowResults['3y']?.weekly, ['enh', 'totalShares']),

          // 3Y Monthly
          monthly_std_return_3y: getFieldNum(windowResults['3y']?.monthly, ['std', 'netProfitPct']),
          monthly_enh_return_3y: getFieldNum(windowResults['3y']?.monthly, ['enh', 'netProfitPct']),
          monthly_alpha_3y: windowResults['3y']?.monthly?.alpha || 0,
          monthly_std_invested_3y: getFieldNum(windowResults['3y']?.monthly, ['std', 'totalInvested']),
          monthly_enh_invested_3y: getFieldNum(windowResults['3y']?.monthly, ['enh', 'totalInvested']),
          monthly_std_value_3y: getFieldNum(windowResults['3y']?.monthly, ['std', 'currentValue']),
          monthly_enh_value_3y: getFieldNum(windowResults['3y']?.monthly, ['enh', 'currentValue']),

          // 5Y Weekly
          std_return_5y: getFieldNum(windowResults['5y']?.weekly, ['std', 'netProfitPct']),
          enh_return_5y: getFieldNum(windowResults['5y']?.weekly, ['enh', 'netProfitPct']),
          alpha_5y: windowResults['5y']?.weekly?.alpha || 0,
          std_invested_5y: getFieldNum(windowResults['5y']?.weekly, ['std', 'totalInvested']),
          enh_invested_5y: getFieldNum(windowResults['5y']?.weekly, ['enh', 'totalInvested']),
          std_value_5y: getFieldNum(windowResults['5y']?.weekly, ['std', 'currentValue']),
          enh_value_5y: getFieldNum(windowResults['5y']?.weekly, ['enh', 'currentValue']),
          std_purchases_5y: windowResults['5y']?.weekly?.purchases?.std || 0,
          enh_purchases_5y: windowResults['5y']?.weekly?.purchases?.enh || 0,
          std_avg_entry_5y: getFieldNum(windowResults['5y']?.weekly, ['std', 'avgEntry']),
          enh_avg_entry_5y: getFieldNum(windowResults['5y']?.weekly, ['enh', 'avgEntry']),
          std_shares_5y: getFieldNum(windowResults['5y']?.weekly, ['std', 'totalShares']),
          enh_shares_5y: getFieldNum(windowResults['5y']?.weekly, ['enh', 'totalShares']),

          // 5Y Monthly
          monthly_std_return_5y: getFieldNum(windowResults['5y']?.monthly, ['std', 'netProfitPct']),
          monthly_enh_return_5y: getFieldNum(windowResults['5y']?.monthly, ['enh', 'netProfitPct']),
          monthly_alpha_5y: windowResults['5y']?.monthly?.alpha || 0,
          monthly_std_invested_5y: getFieldNum(windowResults['5y']?.monthly, ['std', 'totalInvested']),
          monthly_enh_invested_5y: getFieldNum(windowResults['5y']?.monthly, ['enh', 'totalInvested']),
          monthly_std_value_5y: getFieldNum(windowResults['5y']?.monthly, ['std', 'currentValue']),
          monthly_enh_value_5y: getFieldNum(windowResults['5y']?.monthly, ['enh', 'currentValue']),

          updated_at: new Date().toISOString(),
        }

        rowsToUpsert.push(row)

        // 4. Extract and store 5Y signals (weekly + monthly) for instant chart loads
        try {
          const signalResult = await run5YSignalsForStorage(bars)
          if (signalResult) {
            const signalsRow: BacktestSignalsRow = {
              ticker: asset.ticker,
              signals_5y_weekly: signalResult.weekly.signals,
              current_signal_5y_weekly: signalResult.weekly.currentSignal,
              signals_5y_monthly: signalResult.monthly.signals,
              current_signal_5y_monthly: signalResult.monthly.currentSignal,
              updated_at: new Date().toISOString(),
            }
            signalsToUpsert.push(signalsRow)
          }
        } catch (signalErr) {
          console.warn(`Warning: Could not extract signals for ${asset.ticker}`)
        }

        // 5. Extract and store 1Y daily signals
        try {
          const dailyResult = await run1YDailySignalsForStorage(bars)
          if (dailyResult) {
            const dailySignalsRow = {
              ticker: asset.ticker,
              signals_1y: dailyResult.signals,
              current_signal: dailyResult.currentSignal,
              updated_at: new Date().toISOString(),
            }
            dailySignalsToUpsert.push(dailySignalsRow)
          }
        } catch (dailyErr) {
          console.warn(`Warning: Could not extract daily signals for ${asset.ticker}`)
        }

        successCount++
        processedCount++

        if (processedCount % 50 === 0) {
          console.log(`Progress: ${processedCount}/${allAssets.length} assets processed (${successCount} successful)`)
        }
      } catch (err) {
        failureCount++
        processedCount++
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error(`Error processing ${asset.ticker}: ${errorMsg}`)
      }
    }

    console.log(`\n✓ Processed ${processedCount}/${allAssets.length} assets`)
    console.log(`✓ Successfully processed: ${successCount}`)
    console.log(`✓ Rows ready to upsert: ${rowsToUpsert.length}\n`)

    // 3. Upsert backtest_summary in chunks of 50
    if (rowsToUpsert.length > 0) {
      console.log(`Upserting ${rowsToUpsert.length} rows to backtest_summary in chunks...`)
      if (rowsToUpsert[0]) {
        console.log('Sample row columns:', Object.keys(rowsToUpsert[0]).slice(0, 20).join(', '))
        console.log('Sample 1m values:', { enh_return_1m: rowsToUpsert[0].enh_return_1m, std_return_1m: rowsToUpsert[0].std_return_1m })
      }
      const chunkSize = 50
      for (let i = 0; i < rowsToUpsert.length; i += chunkSize) {
        const chunk = rowsToUpsert.slice(i, i + chunkSize)
        const { error: upsertError } = await supabase
          .from('backtest_summary')
          .upsert(chunk, { onConflict: 'ticker' })

        if (upsertError) {
          console.error(`Error upserting chunk ${Math.floor(i / chunkSize) + 1}:`, upsertError)
        } else {
          console.log(`✓ Upserted chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(rowsToUpsert.length / chunkSize)}`)
        }
      }
      console.log(`✓ Backtest summary upserted\n`)
    }

    // 3b. Upsert signals in chunks of 50
    if (signalsToUpsert.length > 0) {
      console.log(`Upserting ${signalsToUpsert.length} rows to backtest_signals in chunks...`)
      const chunkSize = 50
      for (let i = 0; i < signalsToUpsert.length; i += chunkSize) {
        const chunk = signalsToUpsert.slice(i, i + chunkSize)
        const { error: upsertError } = await supabase
          .from('backtest_signals')
          .upsert(chunk, { onConflict: 'ticker' })

        if (upsertError) {
          console.error(`Error upserting signals chunk ${Math.floor(i / chunkSize) + 1}:`, upsertError)
        } else {
          console.log(`✓ Upserted signals chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(signalsToUpsert.length / chunkSize)}`)
        }
      }
      console.log(`✓ Signals upserted\n`)
    }

    // 3c. Upsert daily signals in chunks of 50
    if (dailySignalsToUpsert.length > 0) {
      console.log(`Upserting ${dailySignalsToUpsert.length} rows to daily_signals in chunks...`)
      const chunkSize = 50
      for (let i = 0; i < dailySignalsToUpsert.length; i += chunkSize) {
        const chunk = dailySignalsToUpsert.slice(i, i + chunkSize)
        const { error: upsertError } = await supabase
          .from('daily_signals')
          .upsert(chunk, { onConflict: 'ticker' })

        if (upsertError) {
          console.error(`Error upserting daily signals chunk ${Math.floor(i / chunkSize) + 1}:`, upsertError)
        } else {
          console.log(`✓ Upserted daily signals chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(dailySignalsToUpsert.length / chunkSize)}`)
        }
      }
      console.log(`✓ Daily signals upserted\n`)
    }

    // 3d. Compute and upsert sector stats
    try {
      console.log(`Computing sector aggregates...`)
      const sectorStats = await computeSectorStats(supabase, allAssets)
      if (sectorStats.length > 0) {
        const { error: sectorError } = await supabase
          .from('sector_stats')
          .upsert(sectorStats, { onConflict: 'sector' })

        if (sectorError) {
          console.error('Error upserting sector stats:', sectorError)
        } else {
          console.log(`✓ Upserted ${sectorStats.length} sector stats\n`)
        }
      }
    } catch (sectorErr) {
      console.warn('Warning: Could not compute sector stats:', sectorErr)
    }

    // 4. Summary
    const endTime = Date.now()
    const timeSeconds = ((endTime - startTime) / 1000).toFixed(2)

    console.log('==========================================')
    console.log('        BACKTEST SUMMARY COMPLETE')
    console.log('==========================================')
    console.log(`Total assets:              ${allAssets.length}`)
    console.log(`Successfully processed:    ${successCount}`)
    console.log(`Failed/skipped:            ${failureCount}`)
    console.log(`Rows upserted:             ${rowsToUpsert.length}`)
    console.log(`Time taken:                ${timeSeconds}s`)
    console.log('==========================================\n')
    console.log('✓ Backtest summary ready for SEO components!')
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

main()
