const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/)
    if (match) process.env[match[1].trim()] = match[2].trim()
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  try {
    const { data: asset } = await supabase
      .from('assets')
      .select('*')
      .eq('ticker', 'AAPL')
      .single()

    if (asset) {
      console.log('AAPL Asset Status:')
      console.log(`  is_active: ${asset.is_active}`)
      console.log(`  name: ${asset.name}`)
      console.log(`  sector: ${asset.sector}`)
    } else {
      console.log('AAPL not found in assets table!')
    }

    // Check if there's an error in backfill:prices for AAPL
    console.log('\n=== Checking latest price in DB vs Yahoo ===')
    
    // What's the latest stored date?
    const { data: latest } = await supabase
      .from('daily_prices')
      .select('date')
      .eq('ticker', 'AAPL')
      .order('date', { ascending: false })
      .limit(1)

    console.log(`Latest stored price date for AAPL: ${latest?.[0]?.date || 'none'}`)
    
  } catch (err) {
    console.error('Error:', err.message)
  }
  process.exit(0)
})();
