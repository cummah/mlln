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

const migrationSQL = `
ALTER TABLE backtest_signals
ADD COLUMN IF NOT EXISTS is_new_asset BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS data_quality_score FLOAT DEFAULT 100,
ADD COLUMN IF NOT EXISTS warning_message TEXT;

CREATE INDEX IF NOT EXISTS idx_backtest_signals_is_new_asset
ON backtest_signals(is_new_asset)
WHERE is_new_asset = true;

CREATE INDEX IF NOT EXISTS idx_backtest_signals_quality
ON backtest_signals(data_quality_score)
WHERE data_quality_score < 100;
`

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  console.log('Applying migration to backtest_signals table...')

  try {
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL })
    if (error) throw error
    console.log('✓ Migration applied successfully')
    console.log('✓ Added columns: is_new_asset, data_quality_score, warning_message')
    console.log('✓ Created indexes for new asset discovery')
  } catch (e) {
    console.error('Could not apply migration:', e)
  }
}

main().catch(console.error)
