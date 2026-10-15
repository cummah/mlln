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

export interface BeatStat {
  beats: number
  total: number // assets with a monthly result in that window
}

export type AssetGroup = 'all' | 'stock' | 'etf'

export interface UniverseStats {
  count: number
  stocks: number
  etfs: number
  avgAlpha: Record<RankWindow, number | null> // enhanced minus standard, in points, over every asset with a result
  beatShare: Record<RankWindow, number | null> // share of those assets where enhanced beat standard, 0 to 1
  beat: Record<RankWindow, Record<AssetGroup, BeatStat>> // the same counts split by asset type
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
  top: Record<RankWindow, TopAsset[]> // best standard DCA returns, per window
  universe: UniverseStats
  sectors: SectorHighlight[]
}

const TOP_COUNT = 10

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export async function getHomeData(): Promise<HomeData> {
  const [watchlist, rank, sectorNames] = await Promise.all([getDemoWatchlist(), getRankData(), getAllSectors()])

  // The ten best standard DCA returns in each window, with the enhanced result beside each.
  const top = {} as HomeData['top']
  for (const w of RANK_WINDOWS) {
    top[w] = rank.rows
      .filter(r => r.monthly[w].std !== null && r.monthly[w].enh !== null)
      .sort((x, y) => (y.monthly[w].std as number) - (x.monthly[w].std as number))
      .slice(0, TOP_COUNT)
      .map(r => ({ ticker: r.ticker, name: r.name, sector: r.sector, rank: r.rank, dca: r.dca, cells: r.monthly }))
  }

  const avgAlpha = {} as UniverseStats['avgAlpha']
  const beatShare = {} as UniverseStats['beatShare']
  const beat = {} as UniverseStats['beat']
  for (const w of RANK_WINDOWS) {
    const alphas = rank.rows.map(r => r.monthly[w].alpha).filter((a): a is number => a !== null)
    avgAlpha[w] = mean(alphas)
    beatShare[w] = alphas.length ? alphas.filter(a => a > 0).length / alphas.length : null
    beat[w] = {} as Record<AssetGroup, BeatStat>
    for (const g of ['all', 'stock', 'etf'] as AssetGroup[]) {
      const ga = rank.rows.filter(r => g === 'all' || r.assetType === g).map(r => r.monthly[w].alpha).filter((a): a is number => a !== null)
      beat[w][g] = { beats: ga.filter(a => a > 0).length, total: ga.length }
    }
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
      beat,
    }, sectors }
}
