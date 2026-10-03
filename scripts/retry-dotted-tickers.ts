import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import YahooFinance from 'yahoo-finance2'
import { fileURLToPath } from 'url'

const NULL_VALUES_ERROR = 'SOME (but not all) null values'

async function fetchHistoricalSafe(
  yf: any,
  ticker: string,
  period1: Date,
  period2: Date,
  maxRetries = 5
): Promise<any[]> {
  const end = new Date(period2)
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (end < period1) return []
    try {
      const result = await yf.historical(ticker, { period1, period2: end, interval: '1d' })
      return result || []
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.includes(NULL_VALUES_ERROR) || attempt === maxRetries) throw err
      end.setDate(end.getDate() - 1)
    }
  }
  return []
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const yf = new YahooFinance({ suppressNotices: ['ripHistorical'] })

  // Our ticker (dotted share class) -> the symbol Yahoo Finance actually uses (hyphenated)
  const tickers = ['HEI.A', 'LEN.B', 'MKC.V', 'MOG.B', 'MOG.A', 'UHAL.B', 'BF.A', 'BF.B',
    'WSO.B', 'BIO.B', 'TAP.A', 'CIG.C', 'GEF.B', 'BRK.A', 'PBR.A', 'AKO.A', 'AKO.B',
    'AGM.A', 'BH.A', 'CRD.A', 'CRD.B', 'GTN.A', 'HVT.A']

  const fromDate = new Date('2021-01-01')
  const toDate = new Date()
  const failed: Array<{ ticker: string; error: string }> = []
  let totalRows = 0

  for (const ticker of tickers) {
    const yahooSymbol = ticker.replace('.', '-')
    try {
      const result = await fetchHistoricalSafe(yf, yahooSymbol, fromDate, toDate)
      if (!result || result.length === 0) {
        failed.push({ ticker, error: 'No data returned' })
        await delay(150)
        continue
      }
      const prices = result
        .filter(bar => bar.open != null && bar.high != null && bar.low != null && bar.close != null && bar.volume != null)
        .map(bar => ({
          ticker,
          date: new Date(bar.date).toISOString().split('T')[0],
          open: Number(bar.open),
          high: Number(bar.high),
          low: Number(bar.low),
          close: Number(bar.close),
          volume: Number(bar.volume),
        }))
      const { error } = await supabase.from('daily_prices').upsert(prices, { onConflict: 'ticker,date' })
      if (error) {
        failed.push({ ticker, error: error.message })
      } else {
        totalRows += prices.length
        console.log(`${ticker} (as ${yahooSymbol}): ${prices.length} bars upserted`)
      }
    } catch (err) {
      failed.push({ ticker, error: err instanceof Error ? err.message : String(err) })
    }
    await delay(150)
  }

  console.log(`\nDone. Total rows: ${totalRows}. Failed: ${failed.length}`)
  if (failed.length > 0) console.log(failed)
}

main()
