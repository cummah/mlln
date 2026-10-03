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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const IWB_CSV_URL = 'https://www.ishares.com/us/products/239707/ishares-russell-1000-etf/1467271812596.ajax?fileType=csv&fileName=IWB_holdings&dataType=fund'
const LOCAL_CSV_PATH = path.resolve(__dirname, '../data/IWB_holdings.csv')

async function syncRussell1000() {
  console.log('Fetching Russell 1000 holdings from iShares...')
  
  let csvText = ''
  try {
    const response = await fetch(IWB_CSV_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'text/csv'
      }
    })
    
    if (response.ok) {
      csvText = await response.text()
    }
  } catch (e) {
    console.log('Network fetch failed, falling back to local file if available.')
  }

  // If response is HTML (BlackRock anti-bot), or failed, try local file
  if (!csvText || csvText.trim().startsWith('<!DOCTYPE html>')) {
    console.warn('⚠️ iShares returned HTML instead of CSV (likely anti-bot protection).')
    console.warn(`⚠️ Please manually download the CSV from:\n${IWB_CSV_URL}\nand save it to: ${LOCAL_CSV_PATH}`)
    
    if (fs.existsSync(LOCAL_CSV_PATH)) {
      console.log(`\nFound local CSV at ${LOCAL_CSV_PATH}. Proceeding with local file...`)
      csvText = fs.readFileSync(LOCAL_CSV_PATH, 'utf-8')
    } else {
      throw new Error(`Local file not found at ${LOCAL_CSV_PATH}. Cannot proceed.`)
    }
  }

  const lines = csvText.split('\n').map(line => line.trim())
  
  // Find the header row
  let headerIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Ticker') && lines[i].includes('Name')) {
      headerIdx = i
      break
    }
  }

  if (headerIdx === -1) {
    throw new Error('Could not find header row in CSV. Make sure the CSV format is correct.')
  }

  const newAssets = []
  
  // Need to figure out column indices from the header
  const headerParts = lines[headerIdx].split(',').map(p => p.replace(/(^"|"$)/g, '').trim())
  const tickerIdx = headerParts.indexOf('Ticker')
  const nameIdx = headerParts.indexOf('Name')
  const sectorIdx = headerParts.indexOf('Sector')
  const assetClassIdx = headerParts.indexOf('Asset Class')

  if (tickerIdx === -1 || nameIdx === -1) {
    throw new Error('Could not find Ticker or Name columns in CSV.')
  }
  
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue // Skip empty lines
    
    // Parse CSV line correctly handling quotes
    const regex = /(".*?"|[^",\s]+)(?=\s*,|\s*$)/g;
    let matches = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
      matches.push(match[1].replace(/(^"|"$)/g, ''));
    }
    
    const parts = matches.length >= headerParts.length ? matches : line.split(',').map(p => p.replace(/(^"|"$)/g, ''))
    
    if (parts.length <= tickerIdx) continue

    const ticker = parts[tickerIdx]
    const name = parts[nameIdx]
    const sector = sectorIdx !== -1 ? parts[sectorIdx] : 'Unknown'
    const assetClass = assetClassIdx !== -1 ? parts[assetClassIdx] : 'Equity'

    // Skip cash, futures, etc.
    if (assetClass !== 'Equity' || !ticker || ticker === '-') continue

    // Handle tickers like BRK.B which iShares might represent as BRK B
    const normalizedTicker = ticker.replace(' ', '.')

    newAssets.push({
      ticker: normalizedTicker,
      name,
      sector,
      asset_type: 'Stock',
      is_active: true
    })
  }

  console.log(`Parsed ${newAssets.length} valid equity holdings.`)

  // Fetch existing assets
  console.log('Fetching existing assets from database...')
  const { data: existingAssets, error: fetchError } = await supabase
    .from('assets')
    .select('ticker')

  if (fetchError) {
    throw new Error(`Failed to fetch existing assets: ${fetchError.message}`)
  }

  const existingTickers = new Set(existingAssets.map(a => a.ticker))
  const assetsToAdd = newAssets.filter(a => !existingTickers.has(a.ticker))

  console.log(`Found ${assetsToAdd.length} new entrants to add.`)

  if (assetsToAdd.length > 0) {
    console.log('Inserting new entrants...')
    // Insert in chunks
    const CHUNK = 500
    for (let i = 0; i < assetsToAdd.length; i += CHUNK) {
      const chunk = assetsToAdd.slice(i, i + CHUNK)
      const { error: insertError } = await supabase
        .from('assets')
        .insert(chunk)
      
      if (insertError) {
        console.error('Error inserting chunk:', insertError)
      } else {
        console.log(`  Inserted ${i + chunk.length} / ${assetsToAdd.length}`)
      }
    }
    console.log('Finished inserting new assets.')
  } else {
    console.log('No new assets to add. Universe is up to date.')
  }
}

syncRussell1000().catch(console.error)
