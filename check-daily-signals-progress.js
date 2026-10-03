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
    const { count, error } = await supabase
      .from('daily_signals')
      .select('*', { count: 'exact' })
      .limit(1)

    const { data: recent } = await supabase
      .from('daily_signals')
      .select('ticker')
      .order('updated_at', { ascending: false })
      .limit(10)

    console.log('Daily signals table status:')
    console.log(`  Total rows: ${count || 0}`)
    console.log(`  Recent updates: ${recent?.map(r => r.ticker).join(', ') || 'none'}`)
    
  } catch (err) {
    console.error('Error:', err.message)
  }
  process.exit(0)
})();
