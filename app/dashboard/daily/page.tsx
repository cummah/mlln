import { Metadata } from 'next';
import { getSupabaseClient, fetchAllPages } from '@/lib/supabase';
import { fetchOHLC } from '@/lib/supabase';
import { DailyContent } from './DailyContent';

export const metadata: Metadata = {
  title: 'Daily Signals — All History | mlln.ai',
  description: 'View all daily buy signals across all assets for the past year with performance metrics.',
};

export const revalidate = 3600;

interface SignalRow {
  ticker: string;
  name: string;
  sector: string;
  signalDate: string;
  signalMult: number;
  invested: number;
  currentValue: number | null;
  performance: number | null;
  dcaSuitabilityScore: number | null;
  exitDate: string | null;
  exitReturn: number | null;
  exitScore: number | null;
  exitOpen: boolean;
  weeklyAlignmentDays: number | null;
  monthlyAlignmentDays: number | null;
}

const BASE_AMOUNT = 100;

async function getAllSignals(): Promise<SignalRow[]> {
  try {
    // Get all active assets
    const assets = await fetchAllPages((from, to) =>
      getSupabaseClient()
        .from('assets')
        .select('ticker, name, sector')
        .eq('is_active', true)
        .order('ticker')
        .range(from, to)
    );

    if (!assets || assets.length === 0) return [];

    // Get DCA suitability scores
    const scores = await fetchAllPages((from, to) =>
      getSupabaseClient()
        .from('backtest_summary')
        .select('ticker, dca_suitability_score')
        .in('ticker', (assets as any[]).map((a: any) => a.ticker.toUpperCase()))
        .range(from, to)
    );

    const scoreMap = new Map((scores as any[])?.map((s: any) => [s.ticker, s.dca_suitability_score]) || []);

    // Fetch all signals in batches
    const BATCH_SIZE = 50;
    const allSignalRows: SignalRow[] = [];

    for (let i = 0; i < (assets as any[]).length; i += BATCH_SIZE) {
      const batch = (assets as any[]).slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (asset: any) => {
        try {
          const { data } = await getSupabaseClient()
            .from('daily_signals')
            .select('signals_1y')
            .eq('ticker', asset.ticker.toUpperCase())
            .single();

          const typedData = data as any;
          if (!typedData?.signals_1y) return [];

          // Flatten all signals from this asset into individual rows
          const signals: SignalRow[] = (typedData.signals_1y as any[])
            .filter((sig: any) => sig.finalMult > 0) // Only include actual entries, not skipped days
            .map((sig: any) => {
              const invested = BASE_AMOUNT * sig.finalMult;
              return {
                ticker: asset.ticker,
                name: asset.name,
                sector: asset.sector,
                signalDate: sig.date,
                signalMult: sig.finalMult,
                invested,
                currentValue: sig.exitReturn != null ? invested * (1 + sig.exitReturn / 100) : invested,
                performance: sig.exitReturn ?? null,
                dcaSuitabilityScore: scoreMap.get(asset.ticker.toUpperCase()) ?? null,
                exitDate: sig.exitDate ?? null,
                exitReturn: sig.exitReturn ?? null,
                exitScore: sig.exitScore ?? null,
                exitOpen: sig.exitOpen ?? true,
                weeklyAlignmentDays: null,
                monthlyAlignmentDays: null,
              };
            });

          return signals;
        } catch (err) {
          console.error(`Error fetching signals for ${asset.ticker}:`, err);
          return [];
        }
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(results => allSignalRows.push(...results));

      console.log(`Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(assets.length / BATCH_SIZE)}`);
    }

    // Sort by date descending and limit to most recent 3000 for performance
    const sortedByDate = allSignalRows.sort((a, b) => new Date(b.signalDate).getTime() - new Date(a.signalDate).getTime());
    const recentSignals = sortedByDate.slice(0, 3000);

    // For open trades, fetch latest prices to calculate current performance
    const openTrades = recentSignals.filter(s => s.exitOpen === true && s.performance === null);
    const uniqueOpenTickers = Array.from(new Set(openTrades.map(s => s.ticker)));

    if (uniqueOpenTickers.length > 0) {
      console.log(`Fetching latest prices for ${uniqueOpenTickers.length} tickers with open trades...`);

      // Fetch OHLC for open trade tickers
      const ohlcMap = new Map<string, any[]>();
      for (const ticker of uniqueOpenTickers) {
        try {
          const ohlc = await fetchOHLC(ticker, 365);
          ohlcMap.set(ticker, ohlc);
        } catch (err) {
          console.error(`Error fetching OHLC for ${ticker}:`, err);
        }
      }

      // Update open trades with calculated performance
      recentSignals.forEach(signal => {
        if (signal.exitOpen === true && signal.performance === null) {
          const ohlc = ohlcMap.get(signal.ticker);
          if (ohlc && ohlc.length > 0) {
            const latestPrice = ohlc[ohlc.length - 1].close;
            const priceAtSignal = ohlc.find(d => d.time === signal.signalDate)?.close;

            if (priceAtSignal && latestPrice) {
              const currentValue = signal.invested * (latestPrice / priceAtSignal);
              signal.currentValue = currentValue;
              signal.performance = ((currentValue - signal.invested) / signal.invested) * 100;
            }
          }
        }
      });
    }

    // Compute multi-timeframe alignment using weekly/monthly signal history
    // Wrapped in its own try/catch — alignment is optional; signals must always return
    try {
      const uniqueSignalTickers = Array.from(new Set(recentSignals.map(s => s.ticker.toUpperCase())));
      const weeklyBuyDatesMap = new Map<string, number[]>();
      const monthlyBuyDatesMap = new Map<string, number[]>();

      // Batch the backtest_signals query (50 tickers at a time) to avoid response size limits
      const ALIGN_BATCH = 50;
      for (let i = 0; i < uniqueSignalTickers.length; i += ALIGN_BATCH) {
        const tickerBatch = uniqueSignalTickers.slice(i, i + ALIGN_BATCH);
        const { data: backtestRows, error: backtestErr } = await getSupabaseClient()
          .from('backtest_signals')
          .select('ticker, signals_5y_weekly, signals_5y_monthly')
          .in('ticker', tickerBatch);

        if (backtestErr) {
          console.warn('Alignment batch error:', backtestErr.message);
          continue;
        }

        for (const row of ((backtestRows as any[]) || [])) {
          const weekly = ((row.signals_5y_weekly as any[]) || [])
            .filter((s: any) => s.finalMult > 0 && s.date)
            .map((s: any) => new Date(s.date + 'T12:00:00').getTime());
          weeklyBuyDatesMap.set(row.ticker.toUpperCase(), weekly);

          const monthly = ((row.signals_5y_monthly as any[]) || [])
            .filter((s: any) => s.finalMult > 0 && s.date)
            .map((s: any) => new Date(s.date + 'T12:00:00').getTime());
          monthlyBuyDatesMap.set(row.ticker.toUpperCase(), monthly);
        }
      }

      const WEEKLY_WINDOW_MS = 28 * 24 * 60 * 60 * 1000;  // 4 weeks
      const MONTHLY_WINDOW_MS = 90 * 24 * 60 * 60 * 1000; // 3 months
      for (const signal of recentSignals) {
        const signalTs = new Date(signal.signalDate + 'T12:00:00').getTime();
        const weeklyDates = weeklyBuyDatesMap.get(signal.ticker.toUpperCase()) || [];
        const monthlyDates = monthlyBuyDatesMap.get(signal.ticker.toUpperCase()) || [];

        let bestWeekly: number | null = null;
        for (const wts of weeklyDates) {
          const diff = signalTs - wts;
          if (diff >= 0 && diff <= WEEKLY_WINDOW_MS) {
            const days = Math.floor(diff / (24 * 60 * 60 * 1000));
            if (bestWeekly === null || days < bestWeekly) bestWeekly = days;
          }
        }
        signal.weeklyAlignmentDays = bestWeekly;

        let bestMonthly: number | null = null;
        for (const mts of monthlyDates) {
          const diff = signalTs - mts;
          if (diff >= 0 && diff <= MONTHLY_WINDOW_MS) {
            const days = Math.floor(diff / (24 * 60 * 60 * 1000));
            if (bestMonthly === null || days < bestMonthly) bestMonthly = days;
          }
        }
        signal.monthlyAlignmentDays = bestMonthly;
      }

      console.log(`Alignment computed: ${recentSignals.filter(s => s.weeklyAlignmentDays !== null).length} weekly, ${recentSignals.filter(s => s.monthlyAlignmentDays !== null).length} monthly`);
    } catch (alignErr) {
      console.warn('Alignment computation failed (non-fatal):', alignErr);
    }

    console.log(`\n=== Daily Signals Page Summary ===`);
    console.log(`Total signals in database: ${allSignalRows.length}`);
    console.log(`Displaying most recent: ${recentSignals.length}`);
    console.log(`Total assets: ${assets.length}`);
    console.log(`Open trades with calculated performance: ${recentSignals.filter(s => s.exitOpen && s.performance !== null).length}`);
    console.log(`Date range: ${recentSignals[recentSignals.length - 1]?.signalDate} to ${recentSignals[0]?.signalDate}`);

    return recentSignals;
  } catch (err) {
    console.error('Error fetching all signals:', err);
    return [];
  }
}

export default async function DailySignalsPage() {
  const signalDataRows = await getAllSignals();

  return (
    <div className="min-h-screen bg-[var(--bg)]" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1400px', marginLeft: 'auto', marginRight: 'auto' }}>
      {/* Header */}
      <nav style={{ fontSize: '12px', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
        <a href="/sectors" style={{ color: 'var(--text-2)', textDecoration: 'none', cursor: 'pointer' }} className="hover:text-[var(--text)]">
          Assets
        </a>
        <span>›</span>
        <span style={{ color: 'var(--text)' }}>Daily Signals</span>
      </nav>

      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text)', margin: '0 0 6px 0', letterSpacing: '-0.3px' }}>
          Daily Buy Signals
        </h1>
      </div>

      <DailyContent data={signalDataRows} />
    </div>
  );
}
