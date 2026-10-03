import YahooFinance from 'yahoo-finance2';
import { getSupabaseClient } from '../lib/supabase';

const yahooFinance = new YahooFinance();

async function fetchTicker(ticker: string, startDate: Date, endDate: Date) {
  console.log(`Fetching ${ticker} from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}...`);

  try {
    const result = await yahooFinance.chart(ticker, {
      period1: startDate,
      period2: endDate,
      interval: '1d',
      return: 'array',
    });

    const { quotes } = result;

    if (quotes.length === 0) {
      console.log(`No data returned for ${ticker}.`);
      return;
    }

    console.log(`Fetched ${quotes.length} bars for ${ticker}. Upserting...`);

    const rows = quotes.map((bar) => ({
      ticker,
      date: bar.date.toISOString().split('T')[0],
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
    }));

    // Upsert in chunks of 500 to avoid request size limits
    const CHUNK = 500;
    let total = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await (getSupabaseClient()
        .from('daily_prices') as any)
        .upsert(chunk, { onConflict: 'ticker,date' });
      if (error) {
        console.error(`Upsert error for ${ticker} at chunk starting ${chunk[0].date}:`, error);
        return;
      }
      total += chunk.length;
      console.log(`  ${total}/${rows.length} rows upserted for ${ticker}`);
    }

    console.log(`Done for ${ticker}. ${total} rows upserted.`);
  } catch (err) {
    console.error(`Error fetching data for ${ticker}:`, err);
  }
}

async function main() {
  const tickers = ['SPY', '^VIX'];
  const startDate = new Date('2015-01-01');
  const endDate = new Date();

  for (const ticker of tickers) {
    await fetchTicker(ticker, startDate, endDate);
  }
}

main();
