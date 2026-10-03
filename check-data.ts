import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as fs from 'fs'

const envPath = path.resolve(__dirname, '.env.local')
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

async function main() {
  const { data, error, status } = await supabase
    .from('daily_prices')
    .select('date', { count: 'exact' })
    .eq('ticker', 'SPY')
    .order('date', { ascending: true })
    .range(0, 100000)

  console.log('Status:', status)
  console.log('Error:', error)
  console.log('Returned rows:', data?.length)
  
  if (data) {
    console.log('First date:', data[0]?.date)
    console.log('Last date:', data[data.length - 1]?.date)
  }
}

main()
