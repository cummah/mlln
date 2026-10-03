import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'child_process'
import https from 'https'

// Load .env.local so Supabase keys are available
const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

interface SP500Asset {
  ticker: string
  name: string
  sector: string
}

async function fetchWikipedia(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

function parseWikipediaTable(html: string): SP500Asset[] {
  const assets: SP500Asset[] = []

  // Find the constituents table
  const tableMatch = html.match(/<table[^>]*id="constituents"[^>]*>[\s\S]*?<\/table>/i)
  if (!tableMatch) {
    throw new Error('Could not find constituents table in Wikipedia page')
  }

  const tableHtml = tableMatch[0]

  // Extract all rows from the table body
  const rowMatches = Array.from(tableHtml.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/gi))

  let rowCount = 0
  for (const rowMatch of rowMatches) {
    const row = rowMatch[0]

    // Skip header rows (contain <th>)
    if (row.includes('<th')) {
      continue
    }

    // Extract cells (both <td> and potential <th> in data rows)
    const cells = row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi)
    if (!cells || cells.length < 4) {
      continue
    }

    // Extract text from cells
    const extractText = (cellHtml: string): string => {
      // Remove HTML tags and decode entities
      const text = cellHtml
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      return text
    }

    // Table columns: Symbol (0), Security (1), GICS Sector (2), GICS Sub-Industry (3), ...
    // Extract ticker (column 0)
    let ticker = extractText(cells[0])

    // Extract company name (column 1)
    const name = extractText(cells[1])

    // Extract sector (column 2 - GICS Sector)
    const sector = extractText(cells[2])

    // Skip if essential data is missing
    if (!ticker || !name || !sector) {
      continue
    }

    // Convert dots to hyphens for Yahoo Finance compatibility (BRK.B -> BRK-B)
    ticker = ticker.replace(/\./g, '-')

    assets.push({
      ticker: ticker.toUpperCase(),
      name: name.trim(),
      sector: sector.trim(),
    })

    rowCount++
  }

  console.log(`Parsed ${rowCount} S&P 500 constituents from Wikipedia\n`)
  return assets
}

async function main() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    console.log('==========================================')
    console.log('  S&P 500 Wikipedia Sync to Supabase')
    console.log('==========================================\n')

    // 1. Fetch Wikipedia page
    console.log('Fetching S&P 500 constituents from Wikipedia...')
    const wikiUrl = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies'
    const html = await fetchWikipedia(wikiUrl)

    // 2. Parse the table
    console.log('Parsing Wikipedia table...')
    const sp500Assets = parseWikipediaTable(html)
    console.log(`Found ${sp500Assets.length} S&P 500 companies\n`)

    // 3. Fetch existing assets from Supabase
    console.log('Fetching existing tickers from Supabase...')
    const { data: existingAssets, error: fetchError } = await supabase
      .from('assets')
      .select('ticker')

    if (fetchError || !existingAssets) {
      console.error('Error fetching existing assets:', fetchError)
      process.exit(1)
    }

    const existingTickers = new Set(existingAssets.map((a: { ticker: string }) => a.ticker))
    console.log(`Found ${existingTickers.size} existing tickers in database\n`)

    // 4. Identify new and existing tickers
    const newAssets = sp500Assets.filter(asset => !existingTickers.has(asset.ticker))
    const existingAssetCount = sp500Assets.filter(asset => existingTickers.has(asset.ticker)).length
    const newTickers = newAssets.map(a => a.ticker)

    console.log('==========================================')
    console.log('         SYNC SUMMARY')
    console.log('==========================================')
    console.log(`S&P 500 constituents:  ${sp500Assets.length}`)
    console.log(`Already in database:   ${existingAssetCount}`)
    console.log(`New tickers to add:    ${newAssets.length}`)
    if (newTickers.length > 0) {
      console.log(`\nNew tickers: ${newTickers.join(', ')}\n`)
    } else {
      console.log('')
    }

    // 5. Upsert new assets
    if (newAssets.length > 0) {
      console.log('Upserting new tickers to assets table...')
      const { error: upsertError } = await supabase
        .from('assets')
        .upsert(
          newAssets.map(asset => ({
            ticker: asset.ticker,
            name: asset.name,
            sector: asset.sector,
            is_active: true,
          })),
          { onConflict: 'ticker' }
        )

      if (upsertError) {
        console.error('Error upserting assets:', upsertError)
        process.exit(1)
      }

      console.log(`✓ Successfully upserted ${newAssets.length} new tickers\n`)

      // 6. Run backfill for new tickers only
      console.log('Running price backfill for new tickers...')
      console.log(`Executing: npx ts-node backfill-prices.ts --tickers=${newTickers.join(',')}\n`)

      try {
        execSync(
          `npx ts-node --project tsconfig.scripts.json scripts/backfill-prices.ts --tickers=${newTickers.join(',')}`,
          { stdio: 'inherit', cwd: path.resolve(__dirname, '..') }
        )
        console.log('')
      } catch (error) {
        console.error('\nError running backfill script:', error)
        process.exit(1)
      }
    } else {
      console.log('All S&P 500 constituents already in database. No backfill needed.\n')
    }

    // 7. Final summary
    console.log('==========================================')
    console.log('       OPERATION COMPLETED')
    console.log('==========================================')
    console.log(`Total S&P 500 constituents:  ${sp500Assets.length}`)
    console.log(`New tickers added:           ${newAssets.length}`)
    console.log(`Existing tickers:            ${existingAssetCount}`)
    console.log(`Database total tickers:      ${existingTickers.size + newAssets.length}`)
    console.log('==========================================\n')
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

main()
