// The summary table the rank page reads. It is a staging table while the rebuilt summary is checked against
// the old one. Switching to 'backtest_summary' is a one line change made when the numbers are approved.
export const SUMMARY_TABLE = 'backtest_summary_v2'

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
