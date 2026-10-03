import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const migrationSql = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260901_add_monthly_purchases_to_macro.sql'),
    'utf-8'
  )

  console.log('Applying migration to backtest_summary_macro...')

  const { error } = await supabase.rpc('exec_sql', { sql: migrationSql })

  if (error) {
    console.error('Migration failed:', error.message)
  } else {
    console.log('✓ Migration applied successfully')
  }
}

main().catch(console.error)
