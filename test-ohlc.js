const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const client = createClient(supabaseUrl, supabaseKey)

async function fetchOHLC(ticker) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 365)
  const startDateStr = startDate.toISOString().split('T')[0]
  const endDateStr = new Date().toISOString().split('T')[0]

  try {
    const start = Date.now()
    let allData = []
    const pageSize = 1000
    let page = 0
    let pages = 0

    while (true) {
      const start2 = page * pageSize
      const end = start2 + pageSize - 1

      const result = await client
        .from('daily_prices')
        .select('date, open, high, low, close')
        .eq('ticker', ticker)
        .gte('date', startDateStr)
        .order('date', { ascending: true })
        .range(start2, end)

      if (result.error) {
        console.error(`Error: ${result.error.message}`)
        return null
      }

      if (!result.data || result.data.length === 0) break
      
      allData = allData.concat(result.data)
      pages++
      page++
    }
    
    const elapsed = Date.now() - start
    return { count: allData.length, pages, elapsed }
  } catch (err) {
    console.error(`Exception: ${err.message}`)
    return null
  }
}

async function test() {
  const tickers = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'META']
  
  for (const ticker of tickers) {
    const result = await fetchOHLC(ticker)
    if (result) {
      console.log(`${ticker}: ${result.count} rows in ${result.pages} pages, ${result.elapsed}ms`)
    } else {
      console.log(`${ticker}: FAILED`)
    }
  }
}

test().catch(console.error)
