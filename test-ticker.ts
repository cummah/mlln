import { getBacktestSummary } from '@/lib/backtest-summary'

async function test() {
  const summary = await getBacktestSummary('AAPL')
  if (summary) {
    console.log('=== 1Y ===')
    console.log(`stdPurchases: ${summary.stdPurchases1y}`)
    console.log(`stdInvested: ${summary.stdInvested1y}`)
    console.log(`Expected (purchases * 100): ${summary.stdPurchases1y * 100}`)
    console.log(`Match: ${summary.stdInvested1y === summary.stdPurchases1y * 100 ? '✓' : '✗'}`)

    console.log('\n=== 3Y ===')
    console.log(`stdPurchases: ${summary.stdPurchases3y}`)
    console.log(`stdInvested: ${summary.stdInvested3y}`)
    console.log(`Expected (purchases * 100): ${summary.stdPurchases3y * 100}`)
    console.log(`Match: ${summary.stdInvested3y === summary.stdPurchases3y * 100 ? '✓' : '✗'}`)

    console.log('\n=== 5Y ===')
    console.log(`stdPurchases: ${summary.stdPurchases5y}`)
    console.log(`stdInvested: ${summary.stdInvested5y}`)
    console.log(`Expected (purchases * 100): ${summary.stdPurchases5y * 100}`)
    console.log(`Match: ${summary.stdInvested5y === summary.stdPurchases5y * 100 ? '✓' : '✗'}`)
  }
}

test().catch(console.error)
