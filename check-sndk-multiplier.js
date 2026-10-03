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

async function checkSNDKMultipliers() {
  console.log('\n' + '═'.repeat(80));
  console.log('SNDK SIGNAL MULTIPLIER ANALYSIS');
  console.log('═'.repeat(80) + '\n');

  const MIN_MULTIPLIER = 4;

  try {
    // Check if SNDK exists in daily_signal_enrichment
    const { data: enrichmentData } = await supabase
      .from('daily_signal_enrichment')
      .select('*')
      .eq('ticker', 'SNDK')
      .single();

    if (!enrichmentData || !enrichmentData.signals) {
      console.log('No enrichment data found for SNDK');
      process.exit(0);
    }

    const signals = enrichmentData.signals || [];
    console.log(`Total signals for SNDK: ${signals.length}\n`);

    // Analyze multipliers
    const multipliers = signals.map(s => s.finalMult || 0).sort((a, b) => b - a);
    const aboveThreshold = multipliers.filter(m => m >= MIN_MULTIPLIER).length;
    const belowThreshold = multipliers.filter(m => m < MIN_MULTIPLIER).length;

    console.log(`Daily signals page filter: multiplier >= ${MIN_MULTIPLIER}`);
    console.log('─'.repeat(80));
    console.log(`Above threshold (≥${MIN_MULTIPLIER}): ${aboveThreshold} signals`);
    console.log(`Below threshold (<${MIN_MULTIPLIER}): ${belowThreshold} signals`);

    console.log('\nMultiplier distribution:');
    console.log('─'.repeat(80));
    console.log(`Max:     ${Math.max(...multipliers).toFixed(2)}`);
    console.log(`Median:  ${multipliers[Math.floor(multipliers.length / 2)].toFixed(2)}`);
    console.log(`Min:     ${Math.min(...multipliers).toFixed(2)}`);
    console.log(`Average: ${(multipliers.reduce((a, b) => a + b, 0) / multipliers.length).toFixed(2)}`);

    if (aboveThreshold === 0) {
      console.log('\n⚠️  ISSUE IDENTIFIED:');
      console.log(`None of SNDK's ${signals.length} signals meet the MIN_MULTIPLIER threshold of ${MIN_MULTIPLIER}.`);
      console.log('\nThis is why SNDK "doesn\'t seem to have any signals" on the daily signals page.');
      console.log('The signals exist in the database, but are filtered out due to low position sizing.');

      // Show why signals might have low multipliers
      console.log('\n' + '─'.repeat(80));
      console.log('Possible causes for low multipliers:');
      console.log('  1. Weak DCA suitability score or conviction');
      console.log('  2. Asset added to tracking recently (short history)');
      console.log('  3. High volatility or poor factor regime alignment');
      console.log('  4. Below-average backtest performance');
    } else {
      console.log(`\n✓ ${aboveThreshold} SNDK signals should be visible on the daily signals page`);
    }

  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

checkSNDKMultipliers();
