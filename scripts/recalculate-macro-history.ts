import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load .env.local
const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

const FRED_API_KEY = process.env.FRED_API_KEY
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function fetchHistoricalPCE(): Promise<Record<string, number>> {
  if (!FRED_API_KEY) {
    console.warn('FRED_API_KEY missing, returning empty inflation map.')
    return {}
  }

  // Fetch from 2020 to capture trailing months
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=MMNRNJ&api_key=${FRED_API_KEY}&file_type=json&observation_start=2020-01-01`
  const response = await fetch(url)
  if (!response.ok) {
    console.error(`FRED API error: ${response.status}`)
    return {}
  }

  const data: any = await response.json()
  const map: Record<string, number> = {}
  
  if (data.observations) {
    for (const obs of data.observations) {
      if (obs.value !== '.') {
        // FRED dates are like YYYY-MM-01. We store it keyed by YYYY-MM
        const yearMonth = obs.date.substring(0, 7)
        map[yearMonth] = parseFloat(obs.value)
      }
    }
  }
  return map
}

function classifyRegime(macroScore: number, inflationLevel: number) {
  if (macroScore >= 50) {
    return inflationLevel < 2.5 ? 'Goldilocks' : 'Overheating'
  } else {
    return inflationLevel >= 2.5 ? 'Stagflation' : 'Deflation'
  }
}

async function main() {
  console.log('Fetching historical PCE inflation data from FRED...')
  const pceHistory = await fetchHistoricalPCE()
  
  // Fallback map if API fails based on known US history
  const getPCE = (dateStr: string) => {
    const ym = dateStr.substring(0, 7)
    // Find closest previous month if exact doesn't exist
    let currentYm = ym
    let tries = 0
    while (!pceHistory[currentYm] && tries < 12) {
      const d = new Date(`${currentYm}-01T00:00:00Z`)
      d.setMonth(d.getMonth() - 1)
      currentYm = d.toISOString().substring(0, 7)
      tries++
    }
    
    if (pceHistory[currentYm]) return pceHistory[currentYm]
    
    // Historical fallback if API completely fails
    const year = parseInt(dateStr.substring(0, 4))
    if (year >= 2021 && year <= 2023) return 4.0 // High inflation
    return 2.0 // Low inflation default
  }

  console.log('Fetching macro_regime_history records...')
  
  let offset = 0
  const PAGE = 1000
  let totalUpdated = 0
  const updates = []
  const counts: Record<string, number> = {}

  while (true) {
    const { data, error } = await supabase
      .from('macro_regime_history')
      .select('id, snapshot_date, macro_score, regime_label')
      .range(offset, offset + PAGE - 1)

    if (error || !data || data.length === 0) break

    for (const row of data) {
      const pce = getPCE(row.snapshot_date)
      const newRegime = classifyRegime(row.macro_score, pce)
      
      counts[newRegime] = (counts[newRegime] || 0) + 1
      
      if (row.regime_label !== newRegime) {
        updates.push({
          id: row.id,
          regime_label: newRegime
        })
      }
    }
    
    offset += PAGE
  }

  console.log(`Found ${updates.length} records needing correction.`)
  
  if (updates.length > 0) {
    console.log('Updating database in chunks...')
    const CHUNK = 500
    for (let i = 0; i < updates.length; i += CHUNK) {
      const chunk = updates.slice(i, i + CHUNK)
      const { error } = await supabase.from('macro_regime_history').upsert(chunk, { onConflict: 'id' })
      if (error) {
        console.error('Error updating chunk:', error)
      } else {
        totalUpdated += chunk.length
        console.log(`  Updated ${totalUpdated} / ${updates.length}`)
      }
    }
  }

  console.log('\nNew 5-Year Regime Distribution:')
  for (const [regime, count] of Object.entries(counts)) {
    console.log(`  ${regime}: ${count} days`)
  }
}

main().catch(console.error)
