import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

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

async function main() {
  const { data: assets } = await supabase.from('assets').select('sector').eq('is_active', true)
  const sectors = new Map<string, number>()
  ;(assets as any[])?.forEach(a => sectors.set(a.sector || 'NULL', (sectors.get(a.sector || 'NULL') || 0) + 1))
  console.log('Sector distribution:')
  Array.from(sectors.entries()).sort((a, b) => b[1] - a[1]).forEach(([s, n]) => console.log(`  ${s}: ${n}`))

  const { data: hist, count } = await supabase
    .from('macro_regime_history')
    .select('snapshot_date, regime_label', { count: 'exact' })
    .order('snapshot_date', { ascending: true })
    .limit(5)
  const { data: histEnd } = await supabase
    .from('macro_regime_history')
    .select('snapshot_date, regime_label')
    .order('snapshot_date', { ascending: false })
    .limit(5)
  console.log(`\nmacro_regime_history: ${count} rows`)
  console.log('first:', JSON.stringify(hist))
  console.log('last:', JSON.stringify(histEnd))

  // Regime distribution
  const { data: all } = await supabase.from('macro_regime_history').select('regime_label').limit(5000)
  const regimes = new Map<string, number>()
  ;(all as any[])?.forEach(r => regimes.set(r.regime_label, (regimes.get(r.regime_label) || 0) + 1))
  console.log('regime distribution:', Object.fromEntries(regimes))
}

main()
