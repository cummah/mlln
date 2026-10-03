const path = require('path')
require('ts-node').register({
  project: path.join(__dirname, '..', 'tsconfig.json'),
  compilerOptions: {
    module: 'commonjs'
  }
})

const { calculateAndStoreSignals, getSignal, getSignalHistory } = require('../lib/signals.ts')

const ticker = process.argv[2] || 'AAPL'

async function main() {
  try {
    console.log(`Calculating signals for ${ticker}...`)
    await calculateAndStoreSignals(ticker)
    console.log('✓ Signals calculated and stored')

    console.log('\nFetching current signals...')
    const signal = await getSignal(ticker)
    if (signal) {
      console.log('Weekly Signal:')
      console.log(`  Date: ${signal.weekly_date}`)
      console.log(`  RSI: ${signal.weekly_rsi}`)
      console.log(`  Final Multiplier: ${signal.weekly_final_multiplier}`)
      console.log(`  Final Amount: $${signal.weekly_final_amount}`)
      console.log(`  Regime: ${signal.weekly_regime}`)

      console.log('\nMonthly Signal:')
      console.log(`  Date: ${signal.monthly_date}`)
      console.log(`  RSI: ${signal.monthly_rsi}`)
      console.log(`  Final Multiplier: ${signal.monthly_final_multiplier}`)
      console.log(`  Final Amount: $${signal.monthly_final_amount}`)
      console.log(`  Regime: ${signal.monthly_regime}`)
    }

    console.log('\nTop 10 Weekly Buy Opportunities:')
    const weeklyHistory = await getSignalHistory(ticker, 'weekly')
    weeklyHistory.forEach((h) => {
      console.log(`  Rank ${h.rank}: ${h.signal_date} - Mult: ${h.final_multiplier.toFixed(2)}x - RSI: ${h.rsi.toFixed(1)}`)
    })

    console.log('\nTop 10 Monthly Buy Opportunities:')
    const monthlyHistory = await getSignalHistory(ticker, 'monthly')
    monthlyHistory.forEach((h) => {
      console.log(`  Rank ${h.rank}: ${h.signal_date} - Mult: ${h.final_multiplier.toFixed(2)}x - RSI: ${h.rsi.toFixed(1)}`)
    })
  } catch (err) {
    console.error('Error:', err)
    process.exit(1)
  }
}

main()
