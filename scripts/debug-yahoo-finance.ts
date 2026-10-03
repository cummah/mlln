/**
 * debug-yahoo-finance.ts
 *
 * Debug Yahoo Finance API response structure
 */

async function debugYahooFinance(ticker: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=assetProfile,defaultKeyStatistics,financialData,summaryDetail`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    console.log(`Status: ${response.status}`)

    if (!response.ok) {
      console.log(`Error: ${response.status}`)
      return
    }

    const data = await response.json()
    console.log(JSON.stringify(data, null, 2))
  } catch (error) {
    console.error('Error:', error)
  }
}

debugYahooFinance('EBAY')
