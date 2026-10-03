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

async function checkSNDKEnrichment() {
  console.log('\n' + '═'.repeat(80));
  console.log('SNDK DAILY_SIGNAL_ENRICHMENT CHECK');
  console.log('═'.repeat(80) + '\n');

  try {
    // Check if SNDK exists in daily_signal_enrichment
    const { data: enrichmentData } = await supabase
      .from('daily_signal_enrichment')
      .select('*')
      .eq('ticker', 'SNDK')
      .single();

    if (!enrichmentData) {
      console.log('❌ SNDK not in daily_signal_enrichment table');
      console.log('\nThis is the root cause: The daily page fetches all signals from');
      console.log('daily_signal_enrichment, but SNDK is missing from that table.');

      // Check how many tickers have enrichment data
      const { count: totalCount } = await supabase
        .from('daily_signal_enrichment')
        .select('*', { count: 'exact' });

      console.log(`\nTotal tickers with enrichment data: ${totalCount}`);

      // Get a few sample tickers for reference
      const { data: samples } = await supabase
        .from('daily_signal_enrichment')
        .select('ticker')
        .limit(5);

      if (samples) {
        console.log('\nSample tickers with enrichment data:');
        samples.forEach(s => console.log(`  - ${s.ticker}`));
      }
    } else {
      console.log('✓ SNDK found in daily_signal_enrichment');
      console.log(`Total signals: ${(enrichmentData.signals || []).length}`);

      if (enrichmentData.signals && enrichmentData.signals.length > 0) {
        console.log('\nSample signals:');
        enrichmentData.signals.slice(0, 3).forEach(sig => {
          console.log(`  ${sig.date}: mult=${sig.finalMult}, perf=${sig.performance}`);
        });
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

checkSNDKEnrichment();
