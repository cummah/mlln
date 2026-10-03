// @ts-nocheck
import { unstable_cache } from 'next/cache'
import { getSupabaseClient } from '@/lib/supabase'
import { slugToSector } from '@/lib/sectors'

const CACHE_REVALIDATE = 3 * 60 * 60 // 3 hours in seconds

function getSignalStrength(mult: number): string {
  if (mult >= 3.0) return 'strong'
  if (mult >= 1.5) return 'medium'
  if (mult > 1.0) return 'weak'
  return 'neutral'
}

export interface SectorStats {
  totalAssets: number
  avgRsi: number
  assetsInBuyZone: number
  sectorReturn1M: number
}

export interface TopPerformer {
  ticker: string
  name: string
  dcaReturnPct: number
  signalMult: number
  signalStrength: string
  dcaSuitabilityScore: number
}

export interface OversoldAsset {
  ticker: string
  name: string
  signalMult: number
  signalStrength: string
  signalReasoning: string
  dcaSuitabilityScore: number
}

export interface RecentBuyZoneEntry {
  ticker: string
  name: string
  signalDate: string
  signalMult: number
  currentReturn: number
}

async function getSectorStatsUncached(sector: string): Promise<SectorStats> {
  const sectorName = slugToSector(sector)

  try {
    // 1. Try to load from cached sector_stats table (instant load)
    const { data: cachedStats, error: cacheError } = await getSupabaseClient()
      .from('sector_stats')
      .select('*')
      .eq('sector', sectorName)
      .single() as any

    if (!cacheError && cachedStats) {
      return {
        totalAssets: (cachedStats as any).total_assets || 0,
        avgRsi: Math.round((cachedStats as any).avg_rsi || 50),
        assetsInBuyZone: (cachedStats as any).assets_in_buy_zone || 0,
        sectorReturn1M: Math.round(((cachedStats as any).sector_return_1m || 0) * 100) / 100,
      }
    }

    // 2. Fallback: compute on-the-fly (for fresh sectors)
    console.warn(`Sector stats not cached for ${sectorName}, computing on-the-fly...`)

    // Get total active assets in sector
    const { count: totalAssets } = await getSupabaseClient()
      .from('assets')
      .select('id', { count: 'exact' })
      .eq('sector', sectorName)
      .eq('is_active', true)

    // Get avg RSI for sector
    const { data: assets } = await getSupabaseClient()
      .from('assets')
      .select('ticker')
      .eq('sector', sectorName)
      .eq('is_active', true) as any

    let avgRsi = 0
    let assetsInBuyZone = 0

    if (assets && assets.length > 0) {
      const tickers = (assets as any[]).map(a => a.ticker)
      const { data: prices } = await getSupabaseClient()
        .from('daily_prices')
        .select('ticker, close, date')
        .in('ticker', tickers)
        .order('date', { ascending: true })
        .limit(1400) as any

      if (prices && prices.length > 0) {
        const rsiValues: number[] = []
        const tickerPrices = Object.create(null) as Record<string, number[]>

        (prices as any[]).forEach((p: any) => {
          if (!tickerPrices[p.ticker]) {
            tickerPrices[p.ticker] = []
          }
          tickerPrices[p.ticker].push(p.close)
        })

        for (const ticker of tickers) {
          const tickerData = tickerPrices[ticker] || []
          if (tickerData.length < 14) {
            rsiValues.push(50)
          } else {
            const last14 = tickerData.slice(-14)
            const rsi = calculateSimplifiedRSI(last14)
            rsiValues.push(rsi)
            if (rsi < 35) {
              assetsInBuyZone++
            }
          }
        }

        if (rsiValues.length > 0) {
          avgRsi = Math.round(rsiValues.reduce((a, b) => a + b, 0) / rsiValues.length)
        }
      }
    }

    // Get 1M sector return
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

    let sectorReturn1M = 0
    if (assets && assets.length > 0) {
      const { data: monthPrices } = await getSupabaseClient()
        .from('daily_prices')
        .select('ticker, close, date')
        .in('ticker', (assets as any[]).map(a => a.ticker))
        .gte('date', oneMonthAgo.toISOString().split('T')[0])
        .order('date', { ascending: true }) as any

      if (monthPrices && monthPrices.length > 0) {
        const returns = (assets as any[]).map(asset => {
          const tickerPrices = (monthPrices as any[]).filter(p => p.ticker === asset.ticker)
          if (tickerPrices.length < 2) return 0
          const firstPrice = tickerPrices[0].close
          const lastPrice = tickerPrices[tickerPrices.length - 1].close
          return ((lastPrice - firstPrice) / firstPrice) * 100
        })
        sectorReturn1M = returns.reduce((a, b) => a + b, 0) / returns.length
      }
    }

    return {
      totalAssets: totalAssets || 0,
      avgRsi,
      assetsInBuyZone,
      sectorReturn1M: Math.round(sectorReturn1M * 100) / 100,
    }
  } catch (err) {
    console.error('Error getting sector stats:', err)
    return {
      totalAssets: 0,
      avgRsi: 50,
      assetsInBuyZone: 0,
      sectorReturn1M: 0,
    }
  }
}

async function getTopPerformersUncached(
  sector: string,
  period: '1M' | '3M'
): Promise<TopPerformer[]> {
  const sectorName = slugToSector(sector)
  const returnColumn = period === '1M' ? 'enh_return_1m' : 'enh_return_3m'

  // Get all active assets in sector
  const { data: assets } = await getSupabaseClient()
    .from('assets')
    .select('ticker, name')
    .eq('sector', sectorName)
    .eq('is_active', true) as any

  if (!assets || assets.length === 0) return []
  const tickers = (assets as any[]).map(a => a.ticker)

  // Get period returns from backtest_summary
  const { data: summaries } = await getSupabaseClient()
    .from('backtest_summary')
    .select(`ticker, ${returnColumn}, dca_suitability_score`)
    .in('ticker', tickers) as any

  const summaryMap = Object.fromEntries(
    ((summaries as any[]) || []).map(s => [s.ticker, s])
  )

  // Get current signals
  const { data: signals } = await getSupabaseClient()
    .from('backtest_signals')
    .select('ticker, current_signal_5y_weekly')
    .in('ticker', tickers) as any

  const signalMap = Object.fromEntries(
    ((signals as any[]) || []).map(s => {
      const sig = s?.current_signal_5y_weekly
      const mult = typeof sig === 'object' && sig?.finalMultiplier != null
        ? sig.finalMultiplier
        : 1.0
      return [s.ticker, { mult }]
    })
  )

  // Build performers from backtest data only
  const performers: TopPerformer[] = []
  for (const asset of assets as any[]) {
    const dcaReturnPct = summaryMap[asset.ticker]?.[returnColumn]
    if (dcaReturnPct === null || dcaReturnPct === undefined) continue

    const signalMult = signalMap[asset.ticker]?.mult ?? 1.0
    const dcaSuitabilityScore = summaryMap[asset.ticker]?.dca_suitability_score ?? 0

    performers.push({
      ticker: asset.ticker,
      name: asset.name,
      dcaReturnPct: Math.round(dcaReturnPct * 100) / 100,
      signalMult: Math.round(signalMult * 100) / 100,
      signalStrength: getSignalStrength(signalMult),
      dcaSuitabilityScore: Math.round(dcaSuitabilityScore * 100) / 100,
    })
  }

  // Sort by dcaReturnPct descending, take top 10
  return performers
    .sort((a, b) => b.dcaReturnPct - a.dcaReturnPct)
    .slice(0, 10)
}

async function getBuyOpportunitiesUncached(sector: string): Promise<OversoldAsset[]> {
  const sectorName = slugToSector(sector)

  // Get all active assets in sector
  const { data: assets } = await getSupabaseClient()
    .from('assets')
    .select('ticker, name')
    .eq('sector', sectorName)
    .eq('is_active', true) as any

  if (!assets || assets.length === 0) return []
  const tickers = (assets as any[]).map(a => a.ticker)

  // Get backtest_summary for DCA suitability score
  const { data: summaries } = await getSupabaseClient()
    .from('backtest_summary')
    .select('ticker, dca_suitability_score')
    .in('ticker', tickers) as any

  const summaryMap = Object.fromEntries(
    ((summaries as any[]) || []).map(s => [s.ticker, s])
  )

  // Get current signals — filter to finalMultiplier > 1.0 (active buy signal)
  const { data: signals } = await getSupabaseClient()
    .from('backtest_signals')
    .select('ticker, current_signal_5y_weekly')
    .in('ticker', tickers) as any

  const assetMap = Object.fromEntries((assets as any[]).map(a => [a.ticker, a.name]))
  const buySignals: OversoldAsset[] = []

  for (const sigRow of (signals as any[]) || []) {
    const sig = sigRow?.current_signal_5y_weekly

    if (!sig || typeof sig !== 'object') continue

    const finalMult = sig.finalMultiplier ?? 0
    if (finalMult <= 1.0) continue  // Skip: no enhanced buy signal

    // Build human-readable reasoning from TVSignal fields
    const parts: string[] = []
    if ((sig.rsiMultiplier ?? 1.0) > 1.0) parts.push('RSI oversold')
    if ((sig.drawdownMultiplier ?? 1.0) > 1.0) parts.push('drawdown bonus')
    if ((sig.vixMultiplier ?? 1.0) > 1.0) parts.push('VIX elevated')
    if ((sig.emaMultiplier ?? 1.0) > 1.0) parts.push('below 200 EMA')
    const signalReasoning = parts.length > 0 ? parts.join(' + ') : 'enhanced signal'

    const dcaSuitabilityScore = summaryMap[sigRow.ticker]?.dca_suitability_score ?? 0
    buySignals.push({
      ticker: sigRow.ticker,
      name: assetMap[sigRow.ticker] || sigRow.ticker,
      signalMult: Math.round(finalMult * 100) / 100,
      signalStrength: getSignalStrength(finalMult),
      signalReasoning,
      dcaSuitabilityScore: Math.round(dcaSuitabilityScore * 100) / 100,
    })
  }

  // Sort by finalMult descending (strongest signal first), take top 10
  return buySignals
    .sort((a, b) => b.signalMult - a.signalMult)
    .slice(0, 10)
}

// Export with same name for backward compatibility (used by API and getOversoldAssets export)
async function getOversoldAssetsUncached(sector: string): Promise<OversoldAsset[]> {
  return getBuyOpportunitiesUncached(sector)
}

export async function getRecentBuyZoneEntriesUncached(
  sector: string,
  frequency: 'weekly' | 'monthly' = 'weekly'
): Promise<RecentBuyZoneEntry[]> {
  const MAJOR_BUY_THRESHOLD = 1.0
  try {
    const sectorName = slugToSector(sector)
    const signalColumn = frequency === 'weekly' ? 'signals_5y_weekly' : 'signals_5y_monthly'

    console.error(`[RECENT_BUY_ZONE] Starting for ${sectorName}, frequency=${frequency}, using ${signalColumn}`)

    // Get all active assets in sector
    const { data: assets } = await getSupabaseClient()
      .from('assets')
      .select('ticker, name')
      .eq('sector', sectorName)
      .eq('is_active', true) as any

    if (!assets || assets.length === 0) return []
    const tickers = (assets as any[]).map(a => a.ticker)

    // Get historical signals arrays (not current signal object)
    const { data: signals } = await getSupabaseClient()
      .from('backtest_signals')
      .select(`ticker, ${signalColumn}`)
      .in('ticker', tickers) as any

    // Get most recent price for each ticker (no date limit, just get latest available)
    console.error(`[RECENT_BUY_ZONE] Fetching most recent prices for ${tickers.length} tickers`)

    const { data: latestPrices } = await (getSupabaseClient()
      .from('daily_prices')
      .select('ticker, date, close')
      .in('ticker', tickers)
      .order('date', { ascending: false })
      .limit(tickers.length * 5) as any)

    console.error(`[RECENT_BUY_ZONE] Fetched ${(latestPrices as any[])?.length || 0} price records`)

    const currentPriceMap: Record<string, number> = {}
    for (const p of (latestPrices as any[]) || []) {
      if (!(p.ticker in currentPriceMap)) {
        currentPriceMap[p.ticker] = p.close
      }
    }
    console.error(`[RECENT_BUY_ZONE] Built current price map for ${Object.keys(currentPriceMap).length} tickers`)

    // Process signals: find most recent major buy (5X+) for each ticker
    const assetMap = Object.fromEntries((assets as any[]).map(a => [a.ticker, a.name]))
    const signalDatesByTicker: Record<string, { date: string; mult: number }> = {}

    console.error(`[RECENT_BUY_ZONE] Processing ${(signals as any[])?.length || 0} signal rows for 5x+`)

    for (const sigRow of (signals as any[]) || []) {
      const signalArray = sigRow[signalColumn]

      if (!Array.isArray(signalArray) || signalArray.length === 0) {
        console.error(`[RECENT_BUY_ZONE] ${sigRow.ticker}: signalArray is not a valid array`)
        continue
      }

      // Find most recent signal with finalMult >= 5.0
      // Sort by date descending to ensure we get the most recent
      const sortedSignals = [...signalArray].sort((a, b) => {
        const dateA = new Date(a.date).getTime()
        const dateB = new Date(b.date).getTime()
        return dateB - dateA // descending, most recent first
      })

      let mostRecentMajor: { date: string; finalMult: number } | null = null
      for (const sig of sortedSignals) {
        const finalMult = sig?.finalMult ?? 0
        if (finalMult >= MAJOR_BUY_THRESHOLD) {
          mostRecentMajor = { date: sig.date, finalMult }
          break
        }
      }

      if (mostRecentMajor) {
        signalDatesByTicker[sigRow.ticker] = { date: mostRecentMajor.date, mult: mostRecentMajor.finalMult }
        console.error(`[RECENT_BUY_ZONE] ${sigRow.ticker}: found 5x+ signal on ${mostRecentMajor.date}, mult=${mostRecentMajor.finalMult}`)
      } else {
        console.error(`[RECENT_BUY_ZONE] ${sigRow.ticker}: no 5x+ signal found in history`)
      }
    }

    // Collect all signal dates we need prices for
    const signalDates = Array.from(new Set(Object.values(signalDatesByTicker).map(s => s.date)))
    const qualifyingTickers = Object.keys(signalDatesByTicker)

    console.error(`[RECENT_BUY_ZONE] Found ${qualifyingTickers.length} qualifying tickers with 5x+ signals`)
    console.error(`[RECENT_BUY_ZONE] Signal dates needed: ${signalDates.join(', ')}`)

    if (qualifyingTickers.length === 0) {
      console.error(`[RECENT_BUY_ZONE] No assets qualify (no 5x+ signals found)`)
      return []
    }

    // Batch-fetch prices at signal dates
    // Use range query instead of .in() for better date matching
    const minDate = signalDates.reduce((a, b) => a < b ? a : b)
    const maxDate = signalDates.reduce((a, b) => a > b ? a : b)

    console.error(`[RECENT_BUY_ZONE] Fetching prices for date range ${minDate} to ${maxDate}`)

    const { data: signalPrices } = await getSupabaseClient()
      .from('daily_prices')
      .select('ticker, date, close')
      .in('ticker', qualifyingTickers)
      .gte('date', minDate)
      .lte('date', maxDate) as any

    console.error(`[RECENT_BUY_ZONE] Fetched ${(signalPrices as any[])?.length || 0} price records for signal dates`)

    const signalPriceMap: Record<string, Record<string, number>> = {}
    for (const p of (signalPrices as any[]) || []) {
      if (!signalPriceMap[p.ticker]) signalPriceMap[p.ticker] = {}
      signalPriceMap[p.ticker][p.date] = p.close
    }
    console.error(`[RECENT_BUY_ZONE] Built price map for ${Object.keys(signalPriceMap).length} tickers`)

    // Build entries with calculated returns
    const entries: RecentBuyZoneEntry[] = []

    for (const ticker of qualifyingTickers) {
      const currentPrice = currentPriceMap[ticker]
      const { date: signalDate, mult: signalMult } = signalDatesByTicker[ticker]
      let signalPrice = signalPriceMap[ticker]?.[signalDate]

      if (!currentPrice) {
        console.error(`[RECENT_BUY_ZONE] ${ticker}: No current price found`)
        continue
      }

      // If signal price not found in daily_prices, try using current price
      // (handles case where signal date is very recent/today)
      if (!signalPrice) {
        // Check if signal date is today or within 1 day
        const signalDateObj = new Date(signalDate)
        const today = new Date()
        const daysDiff = Math.floor((today.getTime() - signalDateObj.getTime()) / (1000 * 60 * 60 * 24))

        if (daysDiff <= 1) {
          console.error(`[RECENT_BUY_ZONE] ${ticker}: Signal date is recent (${daysDiff} days ago), using current price`)
          signalPrice = currentPrice
        } else {
          console.error(`[RECENT_BUY_ZONE] ${ticker}: No price found for signal date ${signalDate} (${daysDiff} days ago)`)
          continue
        }
      }

      const currentReturn = ((currentPrice / signalPrice) - 1) * 100

      console.error(`[RECENT_BUY_ZONE] ${ticker}: ADDING - signalDate=${signalDate}, mult=${signalMult}, return=${currentReturn.toFixed(1)}%`)

      entries.push({
        ticker,
        name: assetMap[ticker] || ticker,
        signalDate,
        signalMult: Math.round(signalMult * 100) / 100,
        currentReturn,
      })
    }

    // Sort by return descending, return all (top performers will be shown first)
    const result = entries
      .sort((a, b) => b.currentReturn - a.currentReturn)

    console.error(`[RECENT_BUY_ZONE] returning ${result.length} entries`)
    return result
  } catch (error) {
    console.error(`[RECENT_BUY_ZONE] ERROR:`, error)
    throw error
  }
}

// Cached versions
export const getSectorStats = unstable_cache(
  (sector: string) => getSectorStatsUncached(sector),
  ['sector-stats'],
  { revalidate: CACHE_REVALIDATE, tags: ['sector-stats'] }
)

export const getTopPerformers = unstable_cache(
  (sector: string, period: '1M' | '3M') => getTopPerformersUncached(sector, period),
  ['top-performers'],
  { revalidate: CACHE_REVALIDATE, tags: ['top-performers'] }
)

export const getOversoldAssets = unstable_cache(
  (sector: string) => getOversoldAssetsUncached(sector),
  ['buy-opportunities'],
  { revalidate: CACHE_REVALIDATE, tags: ['buy-opportunities'] }
)

export const getRecentBuyZoneEntries = unstable_cache(
  async (sector: string, frequency: 'weekly' | 'monthly' = 'weekly') => {
    console.error(`[CACHE_WRAPPER] getRecentBuyZoneEntries called for ${sector}, ${frequency}`)
    const result = await getRecentBuyZoneEntriesUncached(sector, frequency)
    console.error(`[CACHE_WRAPPER] getRecentBuyZoneEntries returning ${result.length} entries`)
    return result
  },
  ['recent-strong-signals'],
  { revalidate: CACHE_REVALIDATE, tags: ['recent-strong-signals'] }
)

export interface SectorAsset {
  ticker: string
  name: string
  currentPrice: number
  signalMult: number
  signalStrength: string
  dcaReturn: number
  dcaSuitabilityScore: number
}

async function getSectorAssetsUncached(sector: string): Promise<SectorAsset[]> {
  const sectorName = slugToSector(sector)

  // Get all active assets in sector
  const { data: assets } = await getSupabaseClient()
    .from('assets')
    .select('ticker, name')
    .eq('sector', sectorName)
    .eq('is_active', true) as any

  if (!assets || assets.length === 0) return []
  const tickers = (assets as any[]).map(a => a.ticker)

  // Get backtest_summary for DCA returns (1Y) and suitability score
  const { data: summaries } = await getSupabaseClient()
    .from('backtest_summary')
    .select('ticker, enh_return_1y, dca_suitability_score')
    .in('ticker', tickers) as any

  const summaryMap = Object.fromEntries(
    ((summaries as any[]) || []).map(s => [s.ticker, s])
  )

  // Get current signals
  const { data: signals } = await getSupabaseClient()
    .from('backtest_signals')
    .select('ticker, current_signal_5y_weekly')
    .in('ticker', tickers) as any

  const signalMap = Object.fromEntries(
    ((signals as any[]) || []).map(s => {
      const sig = s?.current_signal_5y_weekly
      const mult = typeof sig === 'object' && sig?.finalMultiplier != null
        ? sig.finalMultiplier
        : 1.0
      return [s.ticker, { mult }]
    })
  )

  // Get ONLY current price from daily_prices (10-day window to handle trading gaps)
  const tenDaysAgo = new Date()
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)
  const cutoff = tenDaysAgo.toISOString().split('T')[0]

  const { data: latestPrices } = await getSupabaseClient()
    .from('daily_prices')
    .select('ticker, date, close')
    .in('ticker', tickers)
    .gte('date', cutoff)
    .order('date', { ascending: false }) as any

  // Deduplicate: keep only the most recent close per ticker
  const priceMap: Record<string, number> = {}
  for (const p of (latestPrices as any[]) || []) {
    if (!(p.ticker in priceMap)) {
      priceMap[p.ticker] = p.close
    }
  }

  // Build sector assets
  const sectorAssets: SectorAsset[] = []

  for (const asset of assets as any[]) {
    const dcaReturn = summaryMap[asset.ticker]?.enh_return_1y ?? 0
    const signalMult = signalMap[asset.ticker]?.mult ?? 1.0
    const currentPrice = priceMap[asset.ticker] ?? 0
    const dcaSuitabilityScore = summaryMap[asset.ticker]?.dca_suitability_score ?? 0

    sectorAssets.push({
      ticker: asset.ticker,
      name: asset.name,
      currentPrice: Math.round(currentPrice * 100) / 100,
      signalMult: Math.round(signalMult * 100) / 100,
      signalStrength: getSignalStrength(signalMult),
      dcaReturn: Math.round(dcaReturn * 100) / 100,
      dcaSuitabilityScore: Math.round(dcaSuitabilityScore * 100) / 100,
    })
  }

  // Sort by dcaReturn descending (best performer first)
  return sectorAssets.sort((a, b) => b.dcaReturn - a.dcaReturn)
}

export const getSectorAssets = unstable_cache(
  (sector: string) => getSectorAssetsUncached(sector),
  ['sector-assets'],
  { revalidate: CACHE_REVALIDATE, tags: ['sector-assets'] }
)
