import { getMacroBacktestSummary } from '@/lib/backtest-summary'

async function test() {
  console.log('Testing getMacroBacktestSummary() for COF...\n')

  const data = await getMacroBacktestSummary('COF')

  if (!data) {
    console.log('ERROR: getMacroBacktestSummary returned null')
    return
  }

  console.log('Macro Backtest Summary for COF:')
  console.log('  stdReturn5y:', data.stdReturn5y)
  console.log('  enhReturn5y:', data.enhReturn5y)
  console.log('  alpha5y:', data.alpha5y)
  console.log('  stdInvested5y:', data.stdInvested5y)
  console.log('  enhInvested5y:', data.enhInvested5y)
  console.log('  stdValue5y:', data.stdValue5y)
  console.log('  enhValue5y:', data.enhValue5y)
}

test()
