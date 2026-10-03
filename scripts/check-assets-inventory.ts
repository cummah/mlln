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

  const { data: sample, error } = await supabase.from('assets').select('*').limit(1)
  if (error) {
    console.error('Error querying assets:', error)
    process.exit(1)
  }
  console.log('Columns:', sample && sample[0] ? Object.keys(sample[0]) : 'no rows')

  const { count } = await supabase.from('assets').select('*', { count: 'exact', head: true })
  console.log('Total assets:', count)

  for (const type of ['stock', 'etf', 'volatility-index', null]) {
    const q = supabase.from('assets').select('*', { count: 'exact', head: true })
    const { count: c } = type === null ? await q.is('asset_type', null) : await q.eq('asset_type', type)
    console.log(`asset_type=${type}:`, c)
  }

  for (const active of [true, false]) {
    const { count: c } = await supabase
      .from('assets')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', active)
    console.log(`is_active=${active}:`, c)
  }
}

main()
