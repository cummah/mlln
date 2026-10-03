const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const client = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data, error } = await client
    .from('assets')
    .select('ticker, name, sector')
    .eq('is_active', true)
    .order('ticker')

  console.log(`Error: ${error ? error.message : 'none'}`)
  console.log(`Total assets: ${data.length}`)
  console.log(`First 5: ${data.slice(0, 5).map(a => a.ticker).join(', ')}`)
  console.log(`Last 5: ${data.slice(-5).map(a => a.ticker).join(', ')}`)
}

test().catch(console.error)
