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

async function checkMacroHistory() {
  console.log('Fetching all macro_regime_history records...')

  let allData: any[] = []
  let offset = 0
  const PAGE = 1000

  while (true) {
    const { data, error } = await supabase
      .from('macro_regime_history')
      .select('regime_label, snapshot_date')
      .range(offset, offset + PAGE - 1)
      .order('snapshot_date', { ascending: true })

    if (error) {
      console.error('Error fetching data:', error)
      return
    }

    if (!data || data.length === 0) break

    allData = allData.concat(data)
    offset += PAGE
    if (data.length < PAGE) break
  }

  if (allData.length === 0) {
    console.log('macro_regime_history table is EMPTY.')
    return
  }

  const minDate = allData[0].snapshot_date
  const maxDate = allData[allData.length - 1].snapshot_date
  
  const counts: Record<string, number> = {}
  allData.forEach(row => {
    const label = row.regime_label || 'NULL/Unknown'
    counts[label] = (counts[label] || 0) + 1
  })

  console.log(`\nTotal Records: ${allData.length}`)
  console.log(`Date Range: ${minDate} to ${maxDate}`)
  console.log('\nRegime State Distribution:')
  for (const [label, count] of Object.entries(counts)) {
    console.log(`  ${label}: ${count} records`)
  }
}

checkMacroHistory()
