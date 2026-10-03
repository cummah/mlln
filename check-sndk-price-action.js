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

async function analyzeSNDKPrice() {
  console.log('\n' + '═'.repeat(80));
  console.log('SNDK PRICE ACTION ANALYSIS');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get all SNDK price data ordered by date
    const { data: prices } = await supabase
      .from('daily_prices')
      .select('date, open, high, low, close')
      .eq('ticker', 'SNDK')
      .order('date', { ascending: true });

    if (!prices || prices.length === 0) {
      console.log('❌ No price data found');
      process.exit(0);
    }

    console.log(`Total price bars: ${prices.length}`);
    console.log(`Date range: ${prices[0].date} to ${prices[prices.length - 1].date}\n`);

    // Calculate price statistics
    const closes = prices.map(p => p.close);
    const minPrice = Math.min(...closes);
    const maxPrice = Math.max(...closes);
    const currentPrice = closes[closes.length - 1];
    const firstPrice = closes[0];

    console.log('PRICE STATISTICS:');
    console.log('─'.repeat(80));
    console.log(`First price (Feb 2025):    $${firstPrice.toFixed(2)}`);
    console.log(`Current price (Aug 2026):  $${currentPrice.toFixed(2)}`);
    console.log(`Min price (peak drawdown): $${minPrice.toFixed(2)}`);
    console.log(`Max price (peak):          $${maxPrice.toFixed(2)}`);
    console.log(`Current vs First:          ${(((currentPrice - firstPrice) / firstPrice) * 100).toFixed(1)}%`);
    console.log(`Max drawdown from peak:    ${(((minPrice - maxPrice) / maxPrice) * 100).toFixed(1)}%`);
    console.log(`Recovery from low:         ${(((currentPrice - minPrice) / minPrice) * 100).toFixed(1)}%\n`);

    // Find when peak and trough occurred
    let peakDate = prices[0].date;
    let peakPrice = closes[0];
    let troughDate = prices[0].date;
    let troughPrice = closes[0];

    for (let i = 0; i < closes.length; i++) {
      if (closes[i] > peakPrice) {
        peakPrice = closes[i];
        peakDate = prices[i].date;
      }
      if (closes[i] < troughPrice) {
        troughPrice = closes[i];
        troughDate = prices[i].date;
      }
    }

    console.log('KEY PRICE EVENTS:');
    console.log('─'.repeat(80));
    console.log(`Peak (${peakDate}):   $${peakPrice.toFixed(2)}`);
    console.log(`Trough (${troughDate}): $${troughPrice.toFixed(2)}`);
    console.log(`Drawdown: ${(((troughPrice - peakPrice) / peakPrice) * 100).toFixed(1)}%\n`);

    // Check if there was a significant drop and recovery
    // Find the biggest single-day drop
    let maxDrop = 0;
    let maxDropDate = null;
    for (let i = 1; i < closes.length; i++) {
      const drop = (closes[i - 1] - closes[i]) / closes[i - 1];
      if (drop > maxDrop) {
        maxDrop = drop;
        maxDropDate = prices[i].date;
      }
    }

    console.log('NOTABLE MOVES:');
    console.log('─'.repeat(80));
    console.log(`Largest single-day drop: ${(maxDrop * 100).toFixed(1)}% on ${maxDropDate}\n`);

    // Check if daily/weekly/monthly should have caught this
    console.log('WHY NO SIGNALS?');
    console.log('─'.repeat(80));

    // For a weekly signal to fire, price needs to dip below weekly EMA
    // Weekly EMA typically 14-50 periods back
    // Monthly EMA typically 20-200 periods back

    console.log('Price dropped from $' + peakPrice.toFixed(2) + ' to $' + troughPrice.toFixed(2) + '\n');
    console.log('If weekly EMA is calculated from 50 days of data:');

    // Find simple moving average at the trough
    const troughIndex = prices.findIndex(p => p.date === troughDate);
    if (troughIndex > 50) {
      const sma50Before = closes.slice(troughIndex - 50, troughIndex)
        .reduce((a, b) => a + b, 0) / 50;
      console.log(`  SMA(50) before trough: $${sma50Before.toFixed(2)}`);
      console.log(`  Trough price: $${troughPrice.toFixed(2)}`);
      console.log(`  Price ${troughPrice < sma50Before ? 'IS' : 'IS NOT'} below SMA(50)`);
    }

    // Show weekly signal dates to see if any align with big drops
    console.log('\nDAILY SIGNALS AROUND MAJOR MOVES:');
    console.log('─'.repeat(80));

    const { data: dailySignals } = await supabase
      .from('daily_signals')
      .select('signals_1y')
      .eq('ticker', 'SNDK')
      .single();

    if (dailySignals && dailySignals.signals_1y) {
      const signals = dailySignals.signals_1y;

      // Find signals between trough-60 days and trough+60 days
      const troughTime = new Date(troughDate).getTime();
      const window = 60 * 24 * 60 * 60 * 1000; // 60 days in ms

      const nearTrough = signals.filter(s => {
        const sigTime = new Date(s.date).getTime();
        return Math.abs(sigTime - troughTime) < window && (s.finalMult || 0) > 0;
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (nearTrough.length > 0) {
        console.log(`Found ${nearTrough.length} daily signals within 60 days of trough:\n`);
        nearTrough.forEach(sig => {
          const daysFromTrough = Math.round((new Date(sig.date).getTime() - troughTime) / (24 * 60 * 60 * 1000));
          console.log(`  ${sig.date} (${daysFromTrough > 0 ? '+' : ''}${daysFromTrough}d): finalMult=${sig.finalMult.toFixed(2)}`);
        });
      } else {
        console.log(`No daily signals within 60 days of trough (${troughDate})`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

analyzeSNDKPrice();
