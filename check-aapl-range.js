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
    // Get the FULL list of AAPL dates
    let allDates = [];
    for (let page = 0; ; page++) {
      const { data } = await supabase
        .from('daily_prices')
        .select('date')
        .eq('ticker', 'AAPL')
        .order('date', { ascending: true })
        .range(page * 1000, (page + 1) * 1000 - 1)

      if (!data || data.length === 0) break
      allDates.push(...data)
      if (data.length < 1000) break
    }

    console.log(`Total AAPL price bars: ${allDates.length}`)
    if (allDates.length > 0) {
      console.log(`First date: ${allDates[0].date}`)
      console.log(`Last date: ${allDates[allDates.length - 1].date}`)
      
      // Check for gaps
      const gaps = [];
      for (let i = 1; i < allDates.length; i++) {
        const prev = new Date(allDates[i-1].date)
        const curr = new Date(allDates[i].date)
        const diffDays = (curr - prev) / (1000 * 60 * 60 * 24)
        if (diffDays > 5) {
          gaps.push(`Gap of ${diffDays.toFixed(0)} days between ${allDates[i-1].date} and ${allDates[i].date}`)
        }
      }
      
      if (gaps.length > 0) {
        console.log(`\nFound ${gaps.length} gaps:`)
        gaps.slice(0, 5).forEach(g => console.log(`  ${g}`))
      }
    }
    
  } catch (err) {
    console.error('Error:', err.message)
  }
  process.exit(0)
})();
