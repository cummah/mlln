/**
 * extend-prices.ts: one-off. Adds price history back to PRICE_START for every active ticker, SPY and ^VIX.
 * The engine needs a year of warm-up before its first signal, so a true five year window needs prices
 * from a year earlier. Only bars older than a ticker's first stored bar are fetched and added.
 * Run: npx ts-node --project tsconfig.scripts.json scripts/extend-prices.ts [--dry-run]
 */
import { createYahooFinanceClient, fetchHistoricalSafe } from '../lib/yahoo-prices'
import { activeTickers } from '../lib/pipeline/bars'
import { getDb, pool, recordRun, upsertChunks } from '../lib/pipeline/db'
import { PRICE_START } from '../lib/pipeline/prices'

const dry = process.argv.includes('--dry-run')

function shift(date: string, days: number): string {
  return new Date(new Date(date + 'T12:00:00Z').getTime() + days * 86400000).toISOString().slice(0, 10)
}

async function main() {
  const started = new Date()
  const db = getDb()
  const yf = createYahooFinanceClient()
  const tickers = Array.from(new Set([...(await activeTickers()), 'SPY', '^VIX']))
  console.log(`extending ${tickers.length} tickers back to ${PRICE_START}${dry ? ' (dry run)' : ''}`)

  let added = 0, touched = 0, skipped = 0
  const failed: { ticker: string; error: string }[] = []
  let done = 0

  await pool(tickers, 6, async ticker => {
    try {
      const { data, error } = await db.from('daily_prices').select('date').eq('ticker', ticker).order('date', { ascending: true }).limit(1)
      if (error) throw new Error(error.message)
      const first: string | undefined = (data as any)?.[0]?.date
      // Already reaches back far enough, or the stock simply was not listed earlier
      if (!first || first <= shift(PRICE_START, 10)) { skipped++; return }

      const raw = await fetchHistoricalSafe(yf, ticker, new Date(PRICE_START + 'T00:00:00Z'), new Date(first + 'T00:00:00Z'))
      const bars = (raw ?? []).flatMap((r: any) => {
        const open = +r.open, high = +r.high, low = +r.low, close = +r.close
        const date = new Date(r.date).toISOString().slice(0, 10)
        if (![open, high, low, close].every(v => Number.isFinite(v) && v > 0) || date >= first) return []
        return [{ ticker, date, open, high, low, close, volume: Number.isFinite(+r.volume) ? +r.volume : 0 }]
      })
      if (bars.length === 0) { skipped++; return }
      if (!dry) await upsertChunks('daily_prices', bars, 'ticker,date', 1000)
      added += bars.length
      touched++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // Yahoo says this when the stock was not listed yet in the requested range. That is expected, not a failure.
      if (/Data doesn't exist/i.test(msg)) skipped++
      else failed.push({ ticker, error: msg })
    } finally {
      if (++done % 200 === 0) console.log(`  ${done}/${tickers.length}  added ${added} rows`)
    }
  })

  console.log(`done: ${added} rows added across ${touched} tickers, ${skipped} unchanged, ${failed.length} failed`)
  failed.slice(0, 15).forEach(f => console.log(`  ${f.ticker}: ${f.error.slice(0, 110)}`))
  if (!dry) await recordRun('extend-prices', new Date().toISOString().slice(0, 10), failed.length > tickers.length * 0.02 ? 'failed' : failed.length ? 'partial' : 'ok', { added, touched, failed: failed.slice(0, 30) }, started)
  process.exit(failed.length > tickers.length * 0.02 ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })
