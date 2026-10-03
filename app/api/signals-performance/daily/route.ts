import { getSupabaseClient, fetchAllPages } from '@/lib/supabase';
import { fetchOHLC } from '@/lib/supabase';

const BASE_AMOUNT = 100;

function getLast12TradingDays(): string[] {
  const days: string[] = [];
  const now = new Date();
  let count = 0;
  while (count < 12) {
    // Use local date, not UTC
    const dayOfWeek = now.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip Sunday (0) and Saturday (6)
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const date = String(now.getDate()).padStart(2, '0');
      days.unshift(`${year}-${month}-${date}`);
      count++;
    }
    now.setDate(now.getDate() - 1);
  }
  return days;
}

export async function GET() {
  try {
    const assets = await fetchAllPages((from, to) =>
      getSupabaseClient()
        .from('assets')
        .select('ticker')
        .eq('is_active', true)
        .range(from, to)
    );

    if (!assets || assets.length === 0) {
      return Response.json([]);
    }

    const tickers = (assets as any[]).map((a: any) => a.ticker);
    const dailyData = new Map<string, { totalInvested: number; totalCurrentValue: number; signalCount: number }>();
    const last12Days = getLast12TradingDays();

    // Initialize all days
    last12Days.forEach(day => {
      dailyData.set(day, { totalInvested: 0, totalCurrentValue: 0, signalCount: 0 });
    });

    // Get signals and OHLC for each asset
    for (const ticker of tickers) {
      try {
        const [signalsRes, ohlcData] = await Promise.all([
          (async () => {
            const { data } = await getSupabaseClient()
              .from('daily_signals')
              .select('signals_1y')
              .eq('ticker', ticker.toUpperCase())
              .limit(1);
            const signals = (data as any)?.[0]?.signals_1y;
            return Array.isArray(signals) ? signals : [];
          })(),
          fetchOHLC(ticker, 365)
        ]);

        if (!signalsRes || !ohlcData) continue;

        const validSignals = signalsRes.filter((s: any) => (s.finalMult || 0) > 0 && s.date);
        const latestPrice = ohlcData[ohlcData.length - 1]?.close;

        if (!latestPrice) continue;

        for (const signal of validSignals) {
          const signalDate = signal.date;

          // Skip if signal is not in last 12 days
          if (!last12Days.includes(signalDate)) continue;

          const signalPrice = ohlcData.find((d: any) => d.time === signalDate)?.close;
          if (!signalPrice) continue;

          const mult = signal.finalMult || 0;
          const invested = BASE_AMOUNT * mult;
          const currentValue = invested * (latestPrice / signalPrice);

          const dayData = dailyData.get(signalDate);
          if (dayData) {
            dayData.totalInvested += invested;
            dayData.totalCurrentValue += currentValue;
            dayData.signalCount++;
          }
        }
      } catch (err) {
        console.error(`Error processing ${ticker}:`, err);
      }
    }

    // Calculate returns and build response
    const result = last12Days.map(day => {
      const data = dailyData.get(day);
      const totalInvested = data?.totalInvested || 0;
      const totalCurrentValue = data?.totalCurrentValue || 0;
      const signalCount = data?.signalCount || 0;

      const actualReturn = totalInvested > 0
        ? ((totalCurrentValue - totalInvested) / totalInvested) * 100
        : 0;

      return {
        period: day,
        return: Math.round(actualReturn * 10) / 10,
        signalCount,
        totalInvested: Math.round(totalInvested),
        totalCurrentValue: Math.round(totalCurrentValue)
      };
    });

    return Response.json(result);
  } catch (err) {
    console.error('Error in daily signals performance:', err);
    return Response.json({ error: 'Failed to calculate performance' }, { status: 500 });
  }
}
