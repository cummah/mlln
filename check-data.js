const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const client = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data, error } = await client
    .from('daily_signals')
    .select('ticker, signals_1y')
    .limit(1)

  console.log('Error:', error)
  console.log('Data length:', data?.length)
  if (data?.[0]) {
    console.log('First record ticker:', data[0].ticker)
    console.log('Has signals_1y:', !!data[0].signals_1y)
  }
}

check()
