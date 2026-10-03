const IWB_CSV_URL = 'https://www.ishares.com/us/products/239707/ishares-russell-1000-etf/1467271812596.ajax?fileType=csv&fileName=IWB_holdings&dataType=fund'

async function printHead() {
  const response = await fetch(IWB_CSV_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/csv'
    }
  })
  const csvText = await response.text()
  const lines = csvText.split('\n')
  for (let i = 0; i < 20; i++) {
    console.log(`Line ${i}: ${lines[i]}`)
  }
}
printHead().catch(console.error)
