import { getSupabaseClient } from '../supabase'
import { SUMMARY_TABLE } from '../rank/config'
import type { BacktestSummary } from '../backtest-summary'

export type Win = '1y' | '3y' | '5y'

/**
 * The summary row in the shape the asset page components already use, plus which windows really exist.
 * A window with too little history is unavailable. It is never presented as a zero result.
 */
export type TickerSummary = BacktestSummary & {
  available: { weekly: Record<Win, boolean>; monthly: Record<Win, boolean> }
}

const camel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())

export async function getTickerSummary(ticker: string): Promise<TickerSummary | null> {
  const { data, error } = await getSupabaseClient().from(SUMMARY_TABLE).select('*').eq('ticker', ticker.toUpperCase()).limit(1)
  if (error) throw new Error(`${SUMMARY_TABLE}: ${error.message}`)
  const row = (data as any[])?.[0]
  if (!row) return null

  // Every numeric column becomes its camelCase name. Missing values become 0 only so the old components can
  // read them. Whether a window exists is carried separately in `available` and the components check it first.
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(row)) out[camel(k)] = typeof v === 'number' ? v : v === null ? 0 : v
  out.backtest_start_date = row.backtest_start ?? null
  out.backtest_start_year = row.backtest_start ? new Date(row.backtest_start).getFullYear() : 0
  out.updated_at = row.updated_at
  out.dca_suitability_score = typeof row.dca_suitability_score === 'number' ? row.dca_suitability_score : null

  const has = (prefix: string, w: Win) => typeof row[`${prefix}enh_return_${w}`] === 'number' && typeof row[`${prefix}std_return_${w}`] === 'number'
  out.available = {
    weekly: { '1y': has('', '1y'), '3y': has('', '3y'), '5y': has('', '5y') },
    monthly: { '1y': has('monthly_', '1y'), '3y': has('monthly_', '3y'), '5y': has('monthly_', '5y') },
  }
  return out as TickerSummary
}
