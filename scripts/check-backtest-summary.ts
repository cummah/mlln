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

    console.log('Checking backtest_summary table...')
    const { data, error, count } = await supabase
      .from('backtest_summary')
      .select('ticker, name, sector, std_return_5y, enh_return_5y, alpha_5y', { count: 'exact' })
      .limit(10)

    if (error) {
      console.error('Error:', error.message)
      return
    }

    console.log(`\nFound ${count} rows in backtest_summary table\n`)

    if (data && data.length > 0) {
      console.log('Sample data:')
      for (const row of data) {
        console.log(`  ${row.ticker}: std=${row.std_return_5y}% enh=${row.enh_return_5y}% alpha=${row.alpha_5y}%`)
      }
    }
  } catch (error) {
    console.error('Fatal error:', error)
  }
}

main()
