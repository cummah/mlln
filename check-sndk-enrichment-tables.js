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

async function checkEnrichmentTables() {
  console.log('\n' + '═'.repeat(80));
  console.log('SIGNAL ENRICHMENT TABLES CHECK FOR SNDK');
  console.log('═'.repeat(80) + '\n');

  const enrichmentTables = ['daily_signal_enrichment', 'weekly_signal_enrichment', 'monthly_signal_enrichment'];

  for (const table of enrichmentTables) {
    console.log(`\n${table.toUpperCase()}`);
    console.log('─'.repeat(80));

    try {
      // Check if table exists and has data for SNDK
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact' })
        .eq('ticker', 'SNDK')
        .single();

      if (error && error.code === 'PGRST116') {
        console.log(`❌ Table does not exist`);
        continue;
      }

      if (error) {
        console.log(`❌ Error: ${error.message}`);
        continue;
      }

      if (!data) {
        console.log(`❌ No data for SNDK`);
        continue;
      }

      console.log(`✓ Found data for SNDK`);

      // Check if signals field exists and has data
      if (data.signals) {
        const signals = Array.isArray(data.signals) ? data.signals : [];
        console.log(`  Total signals: ${signals.length}`);

        if (signals.length > 0) {
          // Count signals with multiplier >= some threshold
          const withMult = signals.filter(s => (s.finalMult || 0) > 0).length;
          console.log(`  Signals with finalMult > 0: ${withMult}`);

          // Show sample
          console.log(`  Sample signals (first 3):`);
          signals.slice(0, 3).forEach((sig, i) => {
            console.log(`    [${i}] date=${sig.date}, finalMult=${sig.finalMult}, signal=${sig.signal}`);
          });
        }
      } else {
        console.log(`  No 'signals' field in record`);
        console.log(`  Record keys: ${Object.keys(data).join(', ')}`);
      }

    } catch (error) {
      console.log(`❌ Error accessing table: ${error.message}`);
    }
  }

  console.log('\n' + '═'.repeat(80) + '\n');
  process.exit(0);
}

checkEnrichmentTables();
