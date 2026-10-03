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

async function getBacktestReturns(ticker: string) {
  try {
    const { data, error } = await supabase
      .from('backtest_summary')
      .select('std_return_5y, std_return_3y, std_return_1y, enh_return_5y, enh_return_3y, enh_return_1y')
      .eq('ticker', ticker.toUpperCase())
      .single()

    console.log(`Error: ${error?.message}`)
    console.log(`Data:`, data)

    if (error) {
      console.warn(`No backtest data for ${ticker}`)
      return null
    }

    return {
      stdReturn5y: data?.std_return_5y || null,
      stdReturn3y: data?.std_return_3y || null,
      stdReturn1y: data?.std_return_1y || null,
      enhReturn5y: data?.enh_return_5y || null,
      enhReturn3y: data?.enh_return_3y || null,
      enhReturn1y: data?.enh_return_1y || null,
    }
  } catch (error) {
    console.error(`Error fetching backtest data for ${ticker}:`, error)
    return null
  }
}

async function test() {
  const result = await getBacktestReturns('AMP')
  console.log('\ngetBacktestReturns result for AMP:')
  console.log(JSON.stringify(result, null, 2))
}

test()
