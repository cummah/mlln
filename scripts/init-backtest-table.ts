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
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    console.log('Creating backtest_summary table in Supabase...\n')

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS public.backtest_summary (
        id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        ticker VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(255),
        sector VARCHAR(100),
        backtest_start DATE,

        std_return_1m NUMERIC(10,2),
        enh_return_1m NUMERIC(10,2),
        alpha_1m NUMERIC(10,2),
        std_invested_1m NUMERIC(15,2),
        enh_invested_1m NUMERIC(15,2),
        std_value_1m NUMERIC(15,2),
        enh_value_1m NUMERIC(15,2),
        std_purchases_1m INTEGER,
        enh_purchases_1m INTEGER,

        std_return_3m NUMERIC(10,2),
        enh_return_3m NUMERIC(10,2),
        alpha_3m NUMERIC(10,2),
        std_invested_3m NUMERIC(15,2),
        enh_invested_3m NUMERIC(15,2),
        std_value_3m NUMERIC(15,2),
        enh_value_3m NUMERIC(15,2),
        std_purchases_3m INTEGER,
        enh_purchases_3m INTEGER,

        std_return_1y NUMERIC(10,2),
        enh_return_1y NUMERIC(10,2),
        alpha_1y NUMERIC(10,2),
        std_invested_1y NUMERIC(15,2),
        enh_invested_1y NUMERIC(15,2),
        std_value_1y NUMERIC(15,2),
        enh_value_1y NUMERIC(15,2),
        std_purchases_1y INTEGER,
        enh_purchases_1y INTEGER,
        std_avg_entry_1y NUMERIC(15,2),
        enh_avg_entry_1y NUMERIC(15,2),
        std_shares_1y NUMERIC(15,6),
        enh_shares_1y NUMERIC(15,6),

        std_return_3y NUMERIC(10,2),
        enh_return_3y NUMERIC(10,2),
        alpha_3y NUMERIC(10,2),
        std_invested_3y NUMERIC(15,2),
        enh_invested_3y NUMERIC(15,2),
        std_value_3y NUMERIC(15,2),
        enh_value_3y NUMERIC(15,2),
        std_purchases_3y INTEGER,
        enh_purchases_3y INTEGER,
        std_avg_entry_3y NUMERIC(15,2),
        enh_avg_entry_3y NUMERIC(15,2),
        std_shares_3y NUMERIC(15,6),
        enh_shares_3y NUMERIC(15,6),

        std_return_5y NUMERIC(10,2),
        enh_return_5y NUMERIC(10,2),
        alpha_5y NUMERIC(10,2),
        std_invested_5y NUMERIC(15,2),
        enh_invested_5y NUMERIC(15,2),
        std_value_5y NUMERIC(15,2),
        enh_value_5y NUMERIC(15,2),
        std_purchases_5y INTEGER,
        enh_purchases_5y INTEGER,
        std_avg_entry_5y NUMERIC(15,2),
        enh_avg_entry_5y NUMERIC(15,2),
        std_shares_5y NUMERIC(15,6),
        enh_shares_5y NUMERIC(15,6),

        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_backtest_summary_ticker ON public.backtest_summary(ticker);
      CREATE INDEX IF NOT EXISTS idx_backtest_summary_sector ON public.backtest_summary(sector);
      CREATE INDEX IF NOT EXISTS idx_backtest_summary_updated ON public.backtest_summary(updated_at);
    `

    // Try using exec via a raw query approach
    // Since Supabase doesn't have a direct exec function, we'll use the query interface
    const statements = createTableSQL.split(';').filter(s => s.trim())

    for (const statement of statements) {
      if (!statement.trim()) continue

      console.log(`Executing: ${statement.trim().substring(0, 80)}...`)
      try {
        // Use the rpc method to execute SQL
        const { error } = await supabase
          .rpc('exec_sql', { sql: statement.trim() })

        if (error && !error.message?.includes('already exists')) {
          console.log(`  Note: ${error?.message || 'Check if table exists'}`)
        } else {
          console.log(`  ✓ Done`)
        }
      } catch (err) {
        console.log(`  (Table may already exist - this is OK)`)
      }
    }

    // Verify table exists by trying to read it
    console.log('\nVerifying table exists...')
    const { data, error, count } = await supabase
      .from('backtest_summary')
      .select('ticker', { count: 'exact' })
      .limit(1)

    if (error) {
      console.error('\n⚠️  Table creation may have failed:')
      console.error(`Error: ${error.message}`)
      console.error('\n📝 Please create the table manually in Supabase SQL Editor using:')
      console.error('supabase/migrations/create_backtest_summary.sql')
    } else {
      console.log('✓ backtest_summary table exists and is ready!')
    }
  } catch (error) {
    console.error('Fatal error:', error)
  }
}

main()
