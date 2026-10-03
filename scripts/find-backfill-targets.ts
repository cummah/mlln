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

  // Newly-inserted rows from today's reconciliation are the backfill targets;
  // everything else was already in the table before this session (and should
  // already have price history).
  const cutoff = '2026-08-18T18:00:00Z'
  const needsBackfill: string[] = []
  const pageSize = 1000
  for (let page = 0; ; page++) {
    const { data: activeAssets, error } = await supabase
      .from('assets')
      .select('ticker, created_at')
      .eq('is_active', true)
      .gte('created_at', cutoff)
      .range(page * pageSize, page * pageSize + pageSize - 1)
    if (error) {
      console.error(error)
      process.exit(1)
    }
    needsBackfill.push(...(activeAssets as any[]).map(a => a.ticker))
    if (!activeAssets || activeAssets.length < pageSize) break
  }
  console.log('Needs backfill (created after cutoff):', needsBackfill.length)
  fs.writeFileSync(
    path.resolve(__dirname, '../backfill-targets.json'),
    JSON.stringify(needsBackfill, null, 2)
  )
}

main()
