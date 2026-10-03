import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env.local
const envPath = path.resolve(__dirname, '../.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

async function testAPI() {
  const ticker = 'AAPL'
  const baseUrl = 'http://localhost:3000'

  try {
    console.log(`Testing signal API for ${ticker}...`)
    const response = await fetch(`${baseUrl}/api/signal/${ticker}?window=5y`)

    if (!response.ok) {
      console.error(`API error: ${response.status}`)
      return
    }

    const data = await response.json()

    if (data.prices) {
      const prices = data.prices as any[]
      console.log(`\nAPI returned ${prices.length} price bars`)
      console.log(`First price: ${prices[0].date}`)
      console.log(`Last price: ${prices[prices.length - 1].date}`)

      if (data.tv?.backtest?.debugDCADays) {
        const signals = data.tv.backtest.debugDCADays as any[]
        console.log(`\nAPI returned ${signals.length} signal days`)
        console.log(`First signal: ${signals[0].date}`)
        console.log(`Last signal: ${signals[signals.length - 1].date}`)
      }
    } else {
      console.log('No prices in response')
      console.log(JSON.stringify(data, null, 2).substring(0, 500))
    }
  } catch (err) {
    console.error('Error:', err)
  }
}

testAPI()
