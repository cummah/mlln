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

async function explore() {
  console.log('=== Exploring Signal Data ===\n')

  // Check macro_regime_history
  const { count: regimeCount } = await supabase
    .from('macro_regime_history')
    .select('*', { count: 'exact', head: true })

  console.log('macro_regime_history:', regimeCount, 'rows')

  // Check backtest_signals
  const { count: signalCount } = await supabase
    .from('backtest_signals')
    .select('*', { count: 'exact', head: true })

  console.log('backtest_signals:', signalCount, 'rows')

  // Sample some backtest_signals for BW
  const { data: bwSignals } = await supabase
    .from('backtest_signals')
    .select('ticker, frequency, signal_type, signal_date')
    .eq('ticker', 'BW')
    .limit(10)

  if (bwSignals && bwSignals.length > 0) {
    console.log('\nSample BW signals (10 most recent):')
    bwSignals.forEach((s: any) => {
      console.log(`  ${s.signal_date} ${s.frequency} ${s.signal_type}`)
    })
  }

  // Count BW buy signals by frequency
  const { data: bwBuySignals } = await supabase
    .from('backtest_signals')
    .select('frequency')
    .eq('ticker', 'BW')
    .eq('signal_type', 'buy')

  if (bwBuySignals) {
    const weekly = bwBuySignals.filter(s => s.frequency === 'weekly').length
    const monthly = bwBuySignals.filter(s => s.frequency === 'monthly').length
    const daily = bwBuySignals.filter(s => s.frequency === 'daily').length
    console.log('\nBW total buy signals:')
    console.log(`  Weekly: ${weekly}`)
    console.log(`  Monthly: ${monthly}`)
    console.log(`  Daily: ${daily}`)
  }
}

explore()
