import { getSupabaseClient, fetchAllPages } from '../supabase'
import { RANK_WINDOWS, SUMMARY_TABLE, type Cell, type RankData, type RankRow, type RankWindow } from './config'

const num = (v: any): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function cols(prefix: string): string {
  return RANK_WINDOWS.flatMap(w => [`${prefix}std_return_${w}`, `${prefix}enh_return_${w}`, `${prefix}alpha_${w}`]).join(', ')
}

function cells(row: any, prefix: string): Record<RankWindow, Cell> {
  const out = {} as Record<RankWindow, Cell>
  for (const w of RANK_WINDOWS) {
    out[w] = { std: num(row[`${prefix}std_return_${w}`]), enh: num(row[`${prefix}enh_return_${w}`]), alpha: num(row[`${prefix}alpha_${w}`]) }
  }
  return out
}

export async function getRankData(): Promise<RankData> {
  const db = getSupabaseClient()
  const [summary, assets] = await Promise.all([
    fetchAllPages<any>((from, to) =>
      db.from(SUMMARY_TABLE).select(`ticker, name, sector, dca_suitability_score, updated_at, ${cols('')}, ${cols('monthly_')}`).range(from, to)),
    fetchAllPages<any>((from, to) => db.from('assets').select('ticker, asset_type').eq('is_active', true).range(from, to)),
  ])
  if (summary.length === 0) throw new Error(`${SUMMARY_TABLE} is empty. Run the summary job.`)
  const type = new Map<string, string>(assets.map(a => [a.ticker, a.asset_type]))

  const rows: RankRow[] = summary
    .filter(s => type.has(s.ticker))
    .map(s => ({
      ticker: s.ticker,
      name: s.name,
      sector: s.sector ?? 'Unknown',
      assetType: type.get(s.ticker) ?? null,
      dca: num(s.dca_suitability_score),
      rank: 0,
      weekly: cells(s, ''),
      monthly: cells(s, 'monthly_'),
    }))

  // Rank by DCA score, ties broken by 5 year weekly alpha, then by ticker so the order is stable
  rows.sort((a, b) => (b.dca ?? -1) - (a.dca ?? -1) || (b.weekly['5y'].alpha ?? -1e9) - (a.weekly['5y'].alpha ?? -1e9) || (a.ticker < b.ticker ? -1 : 1))
  rows.forEach((r, i) => { r.rank = i + 1 })

  const updatedAt = summary.reduce<string | null>((m, s) => (!m || (s.updated_at && s.updated_at > m) ? s.updated_at : m), null)
  return { rows, updatedAt }
}
