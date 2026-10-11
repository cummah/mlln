'use client';

import { SignalChart } from './SignalChart';
import { Card } from '@/components/ui/Card';
import { useAppStore } from '@/store/appStore';
import type { OHLCData, Signal } from '@/types';

interface ChartWithControlsProps {
  ticker: string;
  ohlc: OHLCData[];
  weeklySignals: Signal[];
  monthlySignals: Signal[];
}

/**
 * Prices and signals come from the same stored data as every other page, so a signal looks the same here as in the
 * signal tables. Nothing is recomputed on the fly, which used to give a different multiplier for the same day.
 */
export function ChartWithControls({ ticker, ohlc, weeklySignals, monthlySignals }: ChartWithControlsProps) {
  const { frequency } = useAppStore();
  const signals = frequency === 'monthly' ? monthlySignals : weeklySignals;
  const baseAmount = frequency === 'monthly' ? 433 : 100;

  return (
    <div className="w-full">
      <Card className="p-6">
        <figure style={{ margin: 0 }}>
          <SignalChart ohlc={ohlc} signals={signals} baseAmount={baseAmount} height={320} ticker={ticker} />
          <figcaption style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '12px', textAlign: 'center' }}>
            {frequency === 'monthly' ? 'Monthly' : 'Weekly'} buy signals for {ticker}. Larger markers are larger purchases, up to 6 times the base amount.
          </figcaption>
        </figure>
      </Card>
    </div>
  );
}
