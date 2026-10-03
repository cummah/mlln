import { createClient } from '@supabase/supabase-js'

const migrationSQL = `
ALTER TABLE public.backtest_summary_macro
ADD COLUMN IF NOT EXISTS monthly_std_purchases_1m INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_enh_purchases_1m INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_skipped_1m INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_std_purchases_3m INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_enh_purchases_3m INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_skipped_3m INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_std_purchases_1y INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_enh_purchases_1y INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_skipped_1y INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_std_purchases_3y INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_enh_purchases_3y INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_skipped_3y INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_std_purchases_5y INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_enh_purchases_5y INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_skipped_5y INTEGER DEFAULT 0;
`

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  console.log('Applying migration to backtest_summary_macro table...')

  try {
    const { error } = await supabase.rpc('exec', { sql: migrationSQL })
    if (error) throw error
    console.log('✓ Migration applied successfully')
  } catch (e) {
    console.error('Could not apply migration:', e)
  }
}

main().catch(console.error)
