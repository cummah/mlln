import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

interface NyseRow {
  ticker: string
  name: string
  marketCap: number | null
  revenue: number | null
}

const DRY_RUN = !process.argv.includes('--apply')

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const nyseList: NyseRow[] = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../nyse-over100m.json'), 'utf-8')
  )
  const nasdaq100List: NyseRow[] = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../nasdaq100-full.json'), 'utf-8')
  )

  // NYSE list takes priority; NASDAQ-100 only fills in tickers NYSE doesn't already cover
  const masterByTicker = new Map<string, NyseRow>()
  for (const r of nyseList) masterByTicker.set(r.ticker, r)
  let nasdaqAdded = 0
  for (const r of nasdaq100List) {
    if (!masterByTicker.has(r.ticker)) {
      masterByTicker.set(r.ticker, r)
      nasdaqAdded++
    }
  }

  const knownFunds: string[] = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../known-funds.json'), 'utf-8')
  )
  const knownFundSet = new Set(knownFunds.map(t => t.trim()))

  const { data: assets, error } = await supabase
    .from('assets')
    .select('ticker, asset_type, is_active, market_cap')
  if (error) {
    console.error('Error fetching assets:', error)
    process.exit(1)
  }

  const isFund = (a: { ticker: string; asset_type: string | null }) =>
    a.asset_type === 'etf' || knownFundSet.has(a.ticker.trim())

  const currentByTicker = new Map((assets as any[]).map(a => [a.ticker, a]))

  const toAdd = Array.from(masterByTicker.values()).filter(r => !currentByTicker.has(r.ticker))
  const toDeactivate = (assets as any[]).filter(
    a => a.is_active && !isFund(a) && a.asset_type !== 'volatility-index' && !masterByTicker.has(a.ticker)
  )
  const toKeepStock = (assets as any[]).filter(
    a => a.is_active && !isFund(a) && masterByTicker.has(a.ticker)
  )
  const funds = (assets as any[]).filter(isFund)
  const fundsNeedingRetag = funds.filter(a => a.asset_type !== 'etf')

  console.log(`NYSE master list (>=$100M): ${nyseList.length}`)
  console.log(`NASDAQ-100 tickers added on top (not already in NYSE list): ${nasdaqAdded}`)
  console.log(`Combined master list: ${masterByTicker.size}`)
  console.log(`Current assets total: ${assets!.length}`)
  console.log(`  Funds/ETFs (untouched, ${fundsNeedingRetag.length} mistagged as asset_type!=etf): ${funds.length}`)
  console.log(`  Active stocks matching master list (kept): ${toKeepStock.length}`)
  console.log(`  Active stocks NOT in master list (to deactivate): ${toDeactivate.length}`)
  console.log(`  New tickers not currently in assets (to add): ${toAdd.length}`)

  console.log('\nSample to deactivate:', toDeactivate.slice(0, 10).map(a => a.ticker))
  console.log('Sample to add:', toAdd.slice(0, 10).map(r => r.ticker))
  fs.writeFileSync(
    path.resolve(__dirname, '../to-deactivate.json'),
    JSON.stringify(toDeactivate.map(a => a.ticker), null, 2)
  )

  if (DRY_RUN) {
    console.log('\nDry run only. Re-run with --apply to write changes.')
    return
  }

  if (toDeactivate.length > 0) {
    const { error: deactErr } = await supabase
      .from('assets')
      .update({ is_active: false })
      .in('ticker', toDeactivate.map(a => a.ticker))
    if (deactErr) {
      console.error('Error deactivating:', deactErr)
      process.exit(1)
    }
    console.log(`Deactivated ${toDeactivate.length} tickers`)
  }

  if (fundsNeedingRetag.length > 0) {
    const { error: retagErr } = await supabase
      .from('assets')
      .update({ asset_type: 'etf' })
      .in('ticker', fundsNeedingRetag.map(a => a.ticker))
    if (retagErr) {
      console.error('Error retagging funds:', retagErr)
      process.exit(1)
    }
    console.log(`Retagged ${fundsNeedingRetag.length} mistagged funds as asset_type='etf'`)
  }

  if (toAdd.length > 0) {
    const { error: addErr } = await supabase
      .from('assets')
      .upsert(
        toAdd.map(r => ({
          ticker: r.ticker,
          name: r.name,
          asset_type: 'stock',
          is_active: true,
          market_cap: r.marketCap != null ? Math.round(r.marketCap) : null,
        })),
        { onConflict: 'ticker' }
      )
    if (addErr) {
      console.error('Error adding new tickers:', addErr)
      process.exit(1)
    }
    console.log(`Added ${toAdd.length} new tickers`)
  }

  console.log('\nDone. New tickers still need a price backfill (npm run backfill:prices -- --tickers=...)')
}

main()
