import { getSupabaseClient, fetchOHLC } from '@/lib/supabase';

interface SignalMetrics {
  ticker: string;
  signalDate: string;
  trendStrength: number;
  fiveDayMomentum: number;
  volatility: number;
  avgDailyMove: number;
}

async function calculateMetricsForSignal(ticker: string, signalDate: string): Promise<SignalMetrics | null> {
  try {
    const ohlcData = await fetchOHLC(ticker, 30);
    if (!ohlcData || ohlcData.length === 0) return null;

    // Filter to last 30 days
    const priceData = ohlcData.filter(d => d.time <= signalDate).slice(-30);
    if (priceData.length < 2) return null;

    const closes = priceData.map(d => d.close);
    const highs = priceData.map(d => d.high);
    const lows = priceData.map(d => d.low);

    // Trend Strength: how much of the range was captured by the trend
    const trend = closes[closes.length - 1] - closes[0];
    const range = Math.max(...closes) - Math.min(...closes);
    const trendStrength = range > 0 ? Math.abs(trend) / range : 0;

    // 5-Day Momentum: % change over last 5 days
    const fiveDaysAgo = Math.max(0, closes.length - 6);
    const fiveDayMomentum = ((closes[closes.length - 1] - closes[fiveDaysAgo]) / closes[fiveDaysAgo]) * 100;

    // Volatility: Average True Range as % of close
    let atr = 0;
    for (let i = 1; i < priceData.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      atr += tr;
    }
    const volatility = (atr / (priceData.length - 1)) / closes[closes.length - 1] * 100;

    // Avg Daily Move
    let avgMove = 0;
    for (let i = 1; i < closes.length; i++) {
      avgMove += Math.abs((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    const avgDailyMove = (avgMove / (closes.length - 1)) * 100;

    return {
      ticker,
      signalDate,
      trendStrength: Math.round(trendStrength * 1000) / 1000,
      fiveDayMomentum: Math.round(fiveDayMomentum * 10) / 10,
      volatility: Math.round(volatility * 10) / 10,
      avgDailyMove: Math.round(avgDailyMove * 10) / 10,
    };
  } catch (err) {
    console.error(`Error calculating metrics for ${ticker} on ${signalDate}:`, err);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { signals } = await request.json();

    if (!signals || !Array.isArray(signals)) {
      return Response.json({ error: 'Invalid signals array' }, { status: 400 });
    }

    // Calculate metrics for each signal (limit to avoid timeout)
    const metricsMap = new Map<string, SignalMetrics>();
    const uniqueSignals = Array.from(
      new Map(signals.map(s => [`${s.ticker}-${s.signalDate}`, s])).values()
    ).slice(0, 100); // Reduced limit to 100 to avoid timeout

    // Process in batches to be more efficient
    const batchSize = 10;
    for (let i = 0; i < uniqueSignals.length; i += batchSize) {
      const batch = uniqueSignals.slice(i, i + batchSize);
      const promises = batch.map(signal =>
        calculateMetricsForSignal(signal.ticker, signal.signalDate)
      );

      const results = await Promise.allSettled(promises);
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          const metrics = result.value;
          metricsMap.set(`${metrics.ticker}-${metrics.signalDate}`, metrics);
        }
      });
    }

    return Response.json(Array.from(metricsMap.values()));
  } catch (err) {
    console.error('Error in daily-signal-metrics:', err);
    return Response.json({ error: 'Failed to calculate metrics' }, { status: 500 });
  }
}
