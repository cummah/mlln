// Nightly factor model step. On the first trading day of a month it refits on the two years of
// returns BEFORE that day. On every other night it extends the stored factor series by the new days
// using the fit already in the database. Both paths give the values the backfill would give.

import {
  FIT_RETURNS, dayScore, fitFactors, loadingRows, momentumZ, regimeScore, seriesRows,
  type CloseMatrix, type FactorFit,
} from '../engine/factors'
import { getDb, pagedSelect, pool, upsertChunks, withRetry } from './db'

export interface FactorState {
  fitDate: string | null
  loadings: Map<string, number[]>
  zByDate: Map<string, number[] | null>
  refit: boolean
  newDays: number
}

/** Factor regime of a ticker on a date, or null when the fit that applies is unknown. */
export function factorValue(state: FactorState, ticker: string, date: string): number | null {
  if (!state.fitDate || date < state.fitDate) return null
  return regimeScore(state.loadings.get(ticker), state.zByDate.get(date))
}

const SERIES_TAIL = 330 // enough for the 314 day momentum warm-up

export async function factorStep(calendar: string[], universe: string[]): Promise<FactorState> {
  const db = getDb()
  const D = calendar[calendar.length - 1]

  const loadRows = await pagedSelect<any>('factor_loadings', (from, to) => db.from('factor_loadings').select('*').range(from, to))
  const fitDate = loadRows.length ? (loadRows[0].fit_date as string) : null
  const F = calendar.find(d => d.slice(0, 7) === D.slice(0, 7))!
  const needRefit = !fitDate || fitDate < F

  if (needRefit) {
    const Fidx = calendar.indexOf(F)
    if (Fidx < FIT_RETURNS + 1) throw new Error(`calendar has ${Fidx} days before ${F}, need ${FIT_RETURNS + 1} for a fit`)
    const win = calendar.slice(Fidx - FIT_RETURNS - 1)
    const dateIdx = new Map(win.map((d, i) => [d, i]))
    const closes: CloseMatrix = new Map()
    await pool(universe, 10, async ticker => {
      const rows = await pagedSelect<any>(`closes ${ticker}`, (from, to) =>
        db.from('daily_prices').select('date, close').eq('ticker', ticker).gte('date', win[0]).order('date').range(from, to))
      const a = new Float64Array(win.length).fill(NaN)
      for (const r of rows) { const i = dateIdx.get(r.date); if (i !== undefined && r.close != null) a[i] = +r.close }
      closes.set(ticker, a)
    })
    const Fw = FIT_RETURNS + 1
    const fit = fitFactors(win, closes, Fw)
    if (!fit) throw new Error(`factor refit on ${F} failed: universe too small or history too short`)
    const rows = seriesRows(fit, win, closes, Fw)

    await withRetry('clear factor_loadings', async () => { const { error } = await db.from('factor_loadings').delete().neq('ticker', ''); if (error) throw new Error(error.message) })
    await upsertChunks('factor_loadings', loadingRows(fit), 'ticker')
    await upsertChunks('factor_series', rows, 'date')

    return {
      fitDate: fit.fitDate,
      loadings: fit.loadings,
      zByDate: new Map(rows.map(r => [r.date, r.z])),
      refit: true,
      newDays: rows.filter(r => r.date >= F).length,
    }
  }

  // Extend the existing series
  const fit: FactorFit = {
    fitDate: fitDate!,
    loadings: new Map(loadRows.map(r => [r.ticker as string, (r.loadings as number[]).map(Number)])),
    mean: new Map(loadRows.map(r => [r.ticker as string, +r.mean_ret])),
    std: new Map(loadRows.map(r => [r.ticker as string, +r.std_ret])),
    K: (loadRows[0].loadings as number[]).length,
  }

  const tail = (await withRetry('factor_series tail', async () => {
    const { data, error } = await db.from('factor_series').select('date, fit_date, score, z').order('date', { ascending: false }).limit(SERIES_TAIL)
    if (error) throw new Error(error.message)
    return data as any[]
  })).reverse()
  if (tail.length < 315) throw new Error(`factor_series has only ${tail.length} rows, needs 315. Rerun the backfill or a refit.`)

  const lastDate = tail[tail.length - 1].date as string
  const zByDate = new Map<string, number[] | null>(tail.map(r => [r.date as string, r.z as number[] | null]))
  const newDates = calendar.filter(d => d > lastDate && d <= D)
  if (newDates.length === 0) return { fitDate: fit.fitDate, loadings: fit.loadings, zByDate, refit: false, newDays: 0 }

  // Closes for the new days and the day before the first one, for every ticker in the fit
  const prices = await pagedSelect<any>('closes for new days', (from, to) =>
    db.from('daily_prices').select('ticker, date, close').gte('date', lastDate).lte('date', D).order('date').order('ticker').range(from, to))
  const closeOf = new Map<string, Map<string, number>>()
  for (const r of prices) {
    if (r.close == null) continue
    let m = closeOf.get(r.ticker)
    if (!m) closeOf.set(r.ticker, (m = new Map()))
    m.set(r.date, +r.close)
  }

  const history = tail.map(r => (r.score as number[]).map(Number))
  const outRows: { date: string; fit_date: string; score: number[]; z: number[] | null }[] = []
  let prev = lastDate
  for (const d of newDates) {
    const score = dayScore(fit, t => {
      const m = closeOf.get(t)
      const a = m?.get(prev), b = m?.get(d)
      return a && b ? b / a - 1 : undefined
    })
    history.push(score)
    const z = momentumZ(history, fit.K)
    zByDate.set(d, z)
    outRows.push({ date: d, fit_date: fit.fitDate, score, z })
    prev = d
  }
  await upsertChunks('factor_series', outRows, 'date')
  return { fitDate: fit.fitDate, loadings: fit.loadings, zByDate, refit: false, newDays: outRows.length }
}
