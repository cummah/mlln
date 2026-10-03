import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkData() {
  console.log('1. Checking macro_regime_current...')
  const { data: macroCurrent } = await supabase.from('macro_regime_current').select('*')
  console.log('macro_regime_current:', macroCurrent)

  console.log('\n2. Checking asset_scores_history regime distribution...')
  let allData: any[] = []
  let offset = 0
  const PAGE = 1000

  while (true) {
    const { data, error } = await supabase
      .from('asset_scores_history')
      .select('macro_regime_state')
      .range(offset, offset + PAGE - 1)

    if (error) {
      console.error('Error fetching data:', error)
      return
    }

    if (!data || data.length === 0) break

    allData = allData.concat(data)
    offset += PAGE
    if (data.length < PAGE) break
  }

  const counts: Record<string, number> = {}
  allData.forEach(row => {
    const label = row.macro_regime_state || 'NULL/Unknown'
    counts[label] = (counts[label] || 0) + 1
  })

  console.log(`\nTotal Records in asset_scores_history: ${allData.length}`)
  console.log('Regime State Distribution in asset_scores_history:')
  for (const [label, count] of Object.entries(counts)) {
    console.log(`  ${label}: ${count} records`)
  }
}

checkData()
