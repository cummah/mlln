import { getSupabaseClient, fetchAllPages } from '@/lib/supabase';
import { fetchOHLC } from '@/lib/supabase';

const BASE_AMOUNT = 433;

function getYearMonth(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getLast12Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(getYearMonth(date));
  }
  return months;
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
    const monthlyData = new Map<string, { totalInvested: number; totalCurrentValue: number; signalCount: number }>();
    const last12Months = getLast12Months();

    // Initialize all months
    last12Months.forEach(month => {
      monthlyData.set(month, { totalInvested: 0, totalCurrentValue: 0, signalCount: 0 });
    });

    // Get signals and OHLC for each asset
    for (const ticker of tickers) {
      try {
        const [signalsRes, ohlcData] = await Promise.all([
          (async () => {
            const { data } = await getSupabaseClient()
              .from('backtest_signals')
              .select('signals_5y_monthly')
              .eq('ticker', ticker.toUpperCase())
              .limit(1);
            const signals = (data as any)?.[0]?.signals_5y_monthly;
            return Array.isArray(signals) ? signals : [];
          })(),
          fetchOHLC(ticker, 400)
        ]);

        if (!signalsRes || !ohlcData) continue;

        const validSignals = signalsRes.filter((s: any) => (s.finalMult || 0) > 0 && s.date);
        const latestPrice = ohlcData[ohlcData.length - 1]?.close;

        if (!latestPrice) continue;

        for (const signal of validSignals) {
          const signalDate = signal.date;
          const signalMonth = getYearMonth(new Date(signalDate));

          // Skip if signal is older than 12 months
          if (!last12Months.includes(signalMonth)) continue;

          const signalPrice = ohlcData.find((d: any) => d.time === signalDate)?.close;
          if (!signalPrice) continue;

          const mult = signal.finalMult || 0;
          const invested = BASE_AMOUNT * mult;
          const currentValue = invested * (latestPrice / signalPrice);

          const monthData = monthlyData.get(signalMonth);
          if (monthData) {
            monthData.totalInvested += invested;
            monthData.totalCurrentValue += currentValue;
            monthData.signalCount++;
          }
        }
      } catch (err) {
        console.error(`Error processing ${ticker}:`, err);
      }
    }

    // Calculate returns and build response
    const result = last12Months.map(month => {
      const data = monthlyData.get(month);
      const totalInvested = data?.totalInvested || 0;
      const totalCurrentValue = data?.totalCurrentValue || 0;
      const signalCount = data?.signalCount || 0;

      const actualReturn = totalInvested > 0
        ? ((totalCurrentValue - totalInvested) / totalInvested) * 100
        : 0;

      return {
        period: month,
        return: Math.round(actualReturn * 10) / 10,
        signalCount,
        totalInvested: Math.round(totalInvested),
        totalCurrentValue: Math.round(totalCurrentValue)
      };
    });

    return Response.json(result);
  } catch (err) {
    console.error('Error in monthly signals performance:', err);
    return Response.json({ error: 'Failed to calculate performance' }, { status: 500 });
  }
}
