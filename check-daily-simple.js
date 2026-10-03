const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const client = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data, error } = await client
    .from('daily_signals')
    .select('ticker, signals_1y')
    .limit(5)

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log(`Fetched ${data.length} records`)
  data.forEach(rec => {
    const sigCount = rec.signals_1y ? (Array.isArray(rec.signals_1y) ? rec.signals_1y.length : 'not array') : 'null'
    console.log(`${rec.ticker}: signals_1y type=${typeof rec.signals_1y}, count=${sigCount}`)
  })
}

check()
