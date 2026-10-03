const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const delistedTickers = ['KCAC', 'PNAQ', 'SAMO', 'VECA.RT', 'DGAC.RT', 'AAC'];

async function markDelisted() {
  console.log(`Marking ${delistedTickers.length} tickers as delisted (is_active = false)...\n`);

  for (const ticker of delistedTickers) {
    const { error } = await supabase
      .from('assets')
      .update({ is_active: false })
      .eq('ticker', ticker);

    if (error) {
      console.error(`✗ ${ticker}: ${error.message}`);
    } else {
      console.log(`✓ ${ticker}: marked as delisted`);
    }
  }

  console.log('\nDone! These tickers will be skipped in future backfill runs.');
  process.exit(0);
}

markDelisted().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
