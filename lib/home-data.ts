// Everything the homepage shows comes from the same cached sources as the watchlist, rank and sector pages, so the
// front page can never disagree with the product behind it. A missing value stays missing, it is never shown as a zero.

import { getDemoWatchlist, type DemoWatchlist } from '@/lib/watchlist'
import { getRankData } from '@/lib/rank/data'
import { RANK_WINDOWS, type Cell, type RankWindow } from '@/lib/rank/config'
import { getAllSectors, sectorToSlug } from '@/lib/sectors'
import { getSectorStats } from '@/lib/sector-queries'

export interface TopAsset {
  ticker: string
  name: string
  sector: string
  rank: number
  dca: number | null
  cells: Record<RankWindow, Cell> // monthly plan, per window
}

export interface UniverseStats {
  count: number
  stocks: number
  etfs: number
  avgAlpha: Record<RankWindow, number | null> // enhanced minus standard, in points, over every asset with a result
  beatShare: Record<RankWindow, number | null> // share of those assets where enhanced beat standard, 0 to 1
}

export interface SectorHighlight {
  name: string
  slug: string
  total: number
  inZone: number // weekly multiplier 4x or more today
  mild: number
  return1M: number | null
}

export interface HomeData {
  watchlist: DemoWatchlist
  top: TopAsset[]
  universe: UniverseStats
  sectors: SectorHighlight[]
}

const TOP_COUNT = 8

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export async function getHomeData(): Promise<HomeData> {
  const [watchlist, rank, sectorNames] = await Promise.all([getDemoWatchlist(), getRankData(), getAllSectors()])

  // Ranked by DCA score already. Only assets with a full monthly result in every window can be charted side by side.
  const top: TopAsset[] = rank.rows
    .filter(r => RANK_WINDOWS.every(w => r.monthly[w].std !== null && r.monthly[w].enh !== null))
    .slice(0, TOP_COUNT)
    .map(r => ({ ticker: r.ticker, name: r.name, sector: r.sector, rank: r.rank, dca: r.dca, cells: r.monthly }))

  const avgAlpha = {} as UniverseStats['avgAlpha']
  const beatShare = {} as UniverseStats['beatShare']
  for (const w of RANK_WINDOWS) {
    const alphas = rank.rows.map(r => r.monthly[w].alpha).filter((a): a is number => a !== null)
    avgAlpha[w] = mean(alphas)
    beatShare[w] = alphas.length ? alphas.filter(a => a > 0).length / alphas.length : null
  }

  const stats = await Promise.all(sectorNames.map(async name => ({ name, s: await getSectorStats(sectorToSlug(name)) })))
  const sectors: SectorHighlight[] = stats
    .filter(x => x.s.totalAssets > 0)
    .map(({ name, s }) => ({
      name,
      slug: sectorToSlug(name),
      total: s.totalAssets,
      inZone: s.assetsInBuyZone,
      mild: s.assetsMildSignal,
      return1M: s.sectorReturn1M,
    }))
    .sort((a, b) => b.inZone / b.total - a.inZone / a.total)

  return { watchlist, top, universe: {
      count: rank.rows.length,
      stocks: rank.rows.filter(r => r.assetType === 'stock').length,
      etfs: rank.rows.filter(r => r.assetType === 'etf').length,
      avgAlpha,
      beatShare,
    }, sectors }
}
