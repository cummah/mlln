/**
 * backfill-sectors.ts
 *
 * Fills in assets.sector for rows where sector is 'Other' or NULL,
 * using Yahoo Finance assetProfile. Sectors are stored using Yahoo's
 * GICS-style names (e.g. "Technology", "Healthcare", "Financial Services").
 *
 * Run with: npx ts-node --project tsconfig.scripts.json scripts/backfill-sectors.ts [--dry-run] [--limit N]
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import YahooFinance from 'yahoo-finance2'

const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

const DRY_RUN = process.argv.includes('--dry-run')
const limitArg = process.argv.indexOf('--limit')
const LIMIT = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : Infinity

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function main() {
  const { data: assets, error } = await supabase
    .from('assets')
    .select('id, ticker, sector, asset_type')
    .eq('is_active', true)
    .or('sector.eq.Other,sector.is.null')
    .order('ticker')

  if (error) throw new Error(error.message)

  const targets = ((assets as any[]) || []).slice(0, LIMIT)
  console.log(`${targets.length} assets need a sector${DRY_RUN ? ' (dry run)' : ''}\n`)

  let updated = 0, failed = 0, etf = 0

  for (const asset of targets) {
    try {
      const result: any = await yahooFinance.quoteSummary(asset.ticker, {
        modules: ['assetProfile'],
      })
      const sector = result?.assetProfile?.sector
      const industry = result?.assetProfile?.industry

      if (sector) {
        console.log(`${asset.ticker}: ${sector}${industry ? ` (${industry})` : ''}`)
        if (!DRY_RUN) {
          const { error: upErr } = await supabase
            .from('assets')
            .update({ sector, industry: industry || null })
            .eq('id', asset.id)
          if (upErr) throw new Error(upErr.message)
        }
        updated++
      } else {
        // ETFs and funds have no assetProfile sector
        console.log(`${asset.ticker}: no sector (likely ETF/fund)`)
        etf++
      }
    } catch (err: any) {
      console.warn(`${asset.ticker}: FAILED — ${err.message?.slice(0, 120)}`)
      failed++
    }
    await sleep(250) // stay friendly with Yahoo rate limits
  }

  console.log(`\nDone: ${updated} updated, ${etf} no-sector (ETF/fund), ${failed} failed`)
}

main()
