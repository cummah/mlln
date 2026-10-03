'use client';

import { useState, useEffect } from 'react';
import { SignalChart } from './SignalChart';
import { Skeleton } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';
import type { OHLCData, Signal } from '@/types';

interface ChartWithControlsProps {
  ticker: string;
  initialOhlc: OHLCData[];
  initialSignals: Signal[];
}

export function ChartWithControls({
  ticker,
  initialOhlc,
  initialSignals,
}: ChartWithControlsProps) {
  const [window, setWindow] = useState<'1y' | '3y' | '5y'>('5y');
  const [ohlc, setOhlc] = useState<OHLCData[]>(initialOhlc);
  const [signals, setSignals] = useState<Signal[]>(initialSignals);
  const [loading, setLoading] = useState(false);

  const windowDays = {
    '1y': 365,
    '3y': 1095,
    '5y': 1825,
  };

  useEffect(() => {
    if (window === '5y') {
      // Use initial data for 5y
      setOhlc(initialOhlc);
      setSignals(initialSignals);
      return;
    }

    setLoading(true);
    const fetchWindowData = async () => {
      try {
        // Fetch signal data for window (includes OHLC prices)
        // No cache - always fetch fresh data for current window
        const signalRes = await fetch(`/api/signal/${ticker}?window=${window}`, {
          cache: 'no-store',
        });

        if (!signalRes.ok) {
          throw new Error(`Signal API error: ${signalRes.status}`);
        }

        const signalData = await signalRes.json();

        // Convert prices to OHLC format
        if (signalData.prices && Array.isArray(signalData.prices)) {
          const windowOhlc: OHLCData[] = signalData.prices.map((p: any) => ({
            time: p.date,
            open: p.open,
            high: p.high,
            low: p.low,
            close: p.close,
          }));
          setOhlc(windowOhlc);
        }

        // Process signals (extract from TV enhanced DCA backtest)
        if (signalData.tv?.backtest?.debugDCADays) {
          const newSignals: Signal[] = signalData.tv.backtest.debugDCADays.map((d: any) => ({
            date: d.date,
            mult: d.finalMult || 0,
            skipped: d.finalMult === 0,
            buyAmount: 100 * (d.finalMult || 0),
          }));
          setSignals(newSignals);
        } else {
          // Fallback if no signals
          setSignals([]);
        }
      } catch (err) {
        console.error(`Error fetching ${window} data:`, err);
        // Fallback to initial data
        setOhlc(initialOhlc);
        setSignals(initialSignals);
      } finally {
        setLoading(false);
      }
    };

    fetchWindowData();
  }, [window, ticker, initialOhlc, initialSignals, windowDays]);

  return (
    <div className="w-full">
      <Card className="p-6">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <figure style={{ margin: 0 }}>
            <SignalChart
              ohlc={ohlc}
              signals={signals}
              baseAmount={100}
              height={320}
              ticker={ticker}
            />
            <figcaption style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '12px', textAlign: 'center' }}>
              Buy signal chart for {ticker} — larger markers indicate larger RSI-weighted purchases
            </figcaption>
          </figure>
        )}
      </Card>
    </div>
  );
}
