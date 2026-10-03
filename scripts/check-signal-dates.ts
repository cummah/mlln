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

  const tickers = ['AAPL', 'MSFT', 'AMZN', 'TSLA', 'NVDA']

  for (const ticker of tickers) {
    const { data } = await supabase
      .from('daily_signals')
      .select('signals_1y')
      .eq('ticker', ticker)
      .single()

    if (data?.signals_1y && Array.isArray(data.signals_1y)) {
      const signals = data.signals_1y as any[]
      const dates = signals.map((s: any) => s.date).sort()
      console.log(`${ticker}: ${dates[dates.length - 1]} (${signals.length} signals)`)
    }
  }
}

main().catch(console.error)
