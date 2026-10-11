// The table the nightly summary job rebuilds, read by the rank page, the asset page and the portfolio page.
export const SUMMARY_TABLE = 'backtest_summary'

export type RankWindow = '1y' | '3y' | '5y'
export type RankFreq = 'weekly' | 'monthly'
export const RANK_WINDOWS: RankWindow[] = ['1y', '3y', '5y']

export interface Cell {
  std: number | null
  enh: number | null
  alpha: number | null
}

export interface RankRow {
  ticker: string
  name: string
  sector: string
  assetType: string | null
  dca: number | null
  rank: number // position by DCA score across every asset, 1 is best
  weekly: Record<RankWindow, Cell>
  monthly: Record<RankWindow, Cell>
}

export interface RankData {
  rows: RankRow[]
  updatedAt: string | null
}
