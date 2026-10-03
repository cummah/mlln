const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const client = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data: allSignals } = await client
    .from('daily_signals')
    .select('ticker, signals_1y')
    .limit(100)

  let totalDays = 0
  let totalBuyDays = 0
  let assetsWithSignals = 0
  let assetsWithoutSignals = 0

  allSignals?.forEach(rec => {
    if (!rec.signals_1y || !Array.isArray(rec.signals_1y)) return

    totalDays += rec.signals_1y.length
    const buyDays = rec.signals_1y.filter(s => s.finalMult > 0).length
    totalBuyDays += buyDays

    if (buyDays > 0) {
      assetsWithSignals++
    } else {
      assetsWithoutSignals++
    }
  })

  const buyPercentage = (totalBuyDays / totalDays * 100).toFixed(1)
  console.log(`Sample of 100 assets:`)
  console.log(`  Total days analyzed: ${totalDays}`)
  console.log(`  Buy days: ${totalBuyDays} (${buyPercentage}%)`)
  console.log(`  Assets with at least 1 buy: ${assetsWithSignals}`)
  console.log(`  Assets with no buys: ${assetsWithoutSignals}`)
  console.log(`  Avg buys per asset: ${(totalBuyDays / 100).toFixed(1)}`)
}

test().catch(console.error)
