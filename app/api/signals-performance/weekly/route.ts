import { getSupabaseClient, fetchAllPages } from '@/lib/supabase';
import { fetchOHLC } from '@/lib/supabase';

const BASE_AMOUNT = 100;

function getWeekNumber(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `${d.getUTCFullYear()}-W${String(Math.floor((d.getTime() - yearStart.getTime()) / 604800000) + 1).padStart(2, '0')}`;
}

function getLast12Weeks(): string[] {
  const weeks: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i * 7);
    weeks.push(getWeekNumber(date));
  }
  return Array.from(new Set(weeks));
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
    const weeklyData = new Map<string, { totalInvested: number; totalCurrentValue: number; signalCount: number }>();
    const last12Weeks = getLast12Weeks();

    // Initialize all weeks
    last12Weeks.forEach(week => {
      weeklyData.set(week, { totalInvested: 0, totalCurrentValue: 0, signalCount: 0 });
    });

    // Get signals and OHLC for each asset
    for (const ticker of tickers) {
      try {
        const [signalsRes, ohlcData] = await Promise.all([
          (async () => {
            const { data } = await getSupabaseClient()
              .from('backtest_signals')
              .select('signals_5y_weekly')
              .eq('ticker', ticker.toUpperCase())
              .limit(1);
            const signals = (data as any)?.[0]?.signals_5y_weekly;
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
          const signalWeek = getWeekNumber(new Date(signalDate));

          // Skip if signal is older than 12 weeks
          if (!last12Weeks.includes(signalWeek)) continue;

          const signalPrice = ohlcData.find((d: any) => d.time === signalDate)?.close;
          if (!signalPrice) continue;

          const mult = signal.finalMult || 0;
          const invested = BASE_AMOUNT * mult;
          const currentValue = invested * (latestPrice / signalPrice);

          const weekData = weeklyData.get(signalWeek);
          if (weekData) {
            weekData.totalInvested += invested;
            weekData.totalCurrentValue += currentValue;
            weekData.signalCount++;
          }
        }
      } catch (err) {
        console.error(`Error processing ${ticker}:`, err);
      }
    }

    // Calculate returns and build response
    const result = last12Weeks.map(week => {
      const data = weeklyData.get(week);
      const totalInvested = data?.totalInvested || 0;
      const totalCurrentValue = data?.totalCurrentValue || 0;
      const signalCount = data?.signalCount || 0;

      const actualReturn = totalInvested > 0
        ? ((totalCurrentValue - totalInvested) / totalInvested) * 100
        : 0;

      return {
        period: week,
        return: Math.round(actualReturn * 10) / 10,
        signalCount,
        totalInvested: Math.round(totalInvested),
        totalCurrentValue: Math.round(totalCurrentValue)
      };
    });

    return Response.json(result);
  } catch (err) {
    console.error('Error in weekly signals performance:', err);
    return Response.json({ error: 'Failed to calculate performance' }, { status: 500 });
  }
}
