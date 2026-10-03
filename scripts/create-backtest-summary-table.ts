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

    console.log('Creating backtest_summary table...')

    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS backtest_summary (
          id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          ticker VARCHAR(20) UNIQUE NOT NULL,
          name VARCHAR(255),
          sector VARCHAR(100),
          backtest_start DATE,

          -- 1Y results
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

          -- 3Y results
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

          -- 5Y results
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

        CREATE INDEX IF NOT EXISTS idx_backtest_summary_ticker ON backtest_summary(ticker);
      `
    })

    if (error) {
      console.error('Error creating table:', error.message)
      return
    }

    console.log('✓ backtest_summary table created successfully')
  } catch (err) {
    console.error('Fatal error:', err)
  }
}

main()
