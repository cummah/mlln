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

async function check() {
  try {
    // Get all unique tickers in backtest_signals
    const { data, error } = await supabase
      .from('backtest_signals')
      .select('ticker')
      .order('ticker')

    if (error) {
      console.error('Error:', error)
      return
    }

    const uniqueTickers = Array.from(new Set(data?.map((d: any) => d.ticker) || []))
    console.log(`Total assets with signals: ${uniqueTickers.length}`)
    console.log(`Sample tickers: ${uniqueTickers.slice(0, 20).join(', ')}`)

    // Check a sample with signals
    const { data: sample } = await supabase
      .from('backtest_signals')
      .select('ticker, signals_5y_weekly')
      .eq('ticker', 'AAPL')
      .single()

    if (sample?.signals_5y_weekly) {
      console.log(`\nSample AAPL signals: ${(sample.signals_5y_weekly as any).length} signals`)
      console.log('First 3 signals:', JSON.stringify((sample.signals_5y_weekly as any).slice(0, 3), null, 2))
    }

  } catch (error) {
    console.error('Error:', error)
  }
}

check()
