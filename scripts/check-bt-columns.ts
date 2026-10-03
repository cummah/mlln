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

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  console.log('Checking backtest_summary...')
  const { data, error } = await supabase
    .from('backtest_summary')
    .select('*')

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log(`Total rows: ${data?.length || 0}`)
  
  if (data && data.length > 0) {
    console.log('\nColumns in first row:')
    console.log(Object.keys(data[0]).sort().join('\n'))
    console.log('\nSample data:')
    console.log(JSON.stringify(data[0], null, 2))
  } else {
    console.log('Table is empty')
  }
}

main()
