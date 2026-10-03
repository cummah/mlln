const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const client = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data } = await client
    .from('daily_signals')
    .select('ticker, signals_1y')
    .limit(5)

  data?.forEach(rec => {
    console.log(`\n${rec.ticker}:`)
    
    // Separate skipped and valid
    const skipped = rec.signals_1y.filter(s => s.finalMult === 0)
    const valid = rec.signals_1y.filter(s => s.finalMult > 0)
    
    console.log(`  Total: ${rec.signals_1y.length} (${valid.length} valid, ${skipped.length} skipped)`)
    
    // Check what exit info skipped signals have
    const skippedWithExitDate = skipped.filter(s => s.exitDate)
    const skippedWithExitReturn = skipped.filter(s => s.exitReturn !== null && s.exitReturn !== undefined)
    const skippedWithExitScore = skipped.filter(s => s.exitScore !== null && s.exitScore !== undefined)
    
    console.log(`  Skipped signals with exit info:`)
    console.log(`    exitDate: ${skippedWithExitDate.length}`)
    console.log(`    exitReturn: ${skippedWithExitReturn.length}`)
    console.log(`    exitScore: ${skippedWithExitScore.length}`)
    
    // Sample valid signal
    if (valid.length > 0) {
      const v = valid[0]
      console.log(`  Sample valid: ${v.date}, mult=${v.finalMult}, exitOpen=${v.exitOpen}, exitScore=${v.exitScore}`)
    }
    
    // Sample skipped signal
    if (skipped.length > 0) {
      const s = skipped[0]
      console.log(`  Sample skipped: ${s.date}, mult=${s.finalMult}, exitOpen=${s.exitOpen}, exitScore=${s.exitScore}`)
    }
  })
}

check().catch(console.error)
