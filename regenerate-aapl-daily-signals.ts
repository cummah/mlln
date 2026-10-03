import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { runTVEnhancedDCA, type PriceBar } from './lib/dcaEngine'

const envPath = path.resolve('.env.local')
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

async function main() {
  const ticker = 'AAPL'
  
  console.log(`Regenerating daily signals for ${ticker}...`)
  
  try {
    // Fetch ALL price data
    const { data: pricesData, error } = await supabase
      .from('daily_prices')
      .select('date, open, high, low, close, volume')
      .eq('ticker', ticker)
      .order('date', { ascending: true })

    if (error) {
      console.error('Error fetching prices:', error)
      process.exit(1)
    }

    console.log(`Fetched ${pricesData?.length || 0} price bars`)

    if (!pricesData || pricesData.length < 200) {
      console.error(`Not enough data: ${pricesData?.length || 0} bars (need 200+)`)
      process.exit(1)
    }

    const bars: PriceBar[] = pricesData.map((p: any) => ({
      date: p.date,
      open: Number(p.open),
      high: Number(p.high),
      low: Number(p.low),
      close: Number(p.close),
      volume: Number(p.volume),
    }))

    console.log(`Date range: ${bars[0].date} to ${bars[bars.length - 1].date}`)
    console.log('Running DCA engine in daily mode...')

    const result = runTVEnhancedDCA(bars, {
      baseAmount: 100,
      frequency: 'daily',
      rsiLength: 7,
    })

    const signals_1y = (result.backtest.debugDCADays || [])
      .filter((d: any) => d.finalMult > 0 && d.date)
      .map((d: any) => ({
        date: d.date,
        rsi: d.rsi,
        rsiMult: d.rsiMult,
        emaDistancePct: d.emaDistancePct,
        emaMult: d.emaMult,
        adx: d.adx,
        plusDI: d.plusDI,
        minusDI: d.minusDI,
        regime: d.regime || 'ranging',
        regimeAdj: d.regimeAdj,
        drawdownPct: d.drawdownPct,
        ddBonus: d.ddBonus,
        vixBonus: d.vixBonus || 1,
        finalMult: d.finalMult,
        isCapped: d.isCapped || false,
      }))

    console.log(`Generated ${signals_1y.length} signals`)
    if (signals_1y.length > 0) {
      const dates = signals_1y.map(s => s.date).sort().reverse()
      console.log(`Latest dates: ${dates.slice(0, 5).join(', ')}`)
    }

    console.log('Upserting to daily_signals...')
    const { error: upsertError } = await supabase
      .from('daily_signals')
      .upsert(
        {
          ticker,
          signals_1y,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'ticker' }
      )

    if (upsertError) {
      console.error('Upsert error:', upsertError)
      process.exit(1)
    }

    console.log('✓ Successfully updated AAPL daily signals')

  } catch (err) {
    console.error('Error:', err)
    process.exit(1)
  }
}

main()
