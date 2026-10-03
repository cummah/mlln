'use client';

import { useEffect, useState } from 'react';
import { PeriodReturnsChart } from '@/components/ticker/PeriodReturnsChart';
import { WeeklySignalsTable } from './WeeklySignalsTable';

interface SignalRow {
  ticker: string;
  name: string;
  sector: string;
  signalDate: string | null;
  signalMult: number | null;
  invested: number | null;
  performance: number | null;
  currentValue: number | null;
  exitAdjustedPerformance: number | null;
  exitAdjustedValue: number | null;
  dcaSuitabilityScore: number | null;
  fundamentalQualityScore: number | null;
  finalConvictionScore: number | null;
  macroRegimeState: string | null;
  factorRegimeScore: number | null;
  factorRegimeLabel: string | null;
  volTimingScore: number | null;
  volTimingLabel: string | null;
  meanReversionScore: number | null;
  meanReversionLabel: string | null;
  tags: string[] | null;
  exitDate: string | null;
  exitReturn: number | null;
  exitScore: number | null;
  exitDateNextOpen: string | null;
  exitReturnNextOpen: number | null;
  exitOpen: boolean;
  tickerAlpha5y: number | null;
}

interface PeriodReturn {
  period: string;
  return: number;
  signalCount: number;
}

export function WeeklyContent({ data }: { data: SignalRow[] }) {
  const [chartData, setChartData] = useState<PeriodReturn[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  useEffect(() => {
    const fetchChartData = async () => {
      try {
        const response = await fetch('/api/signals-performance/weekly');
        if (response.ok) {
          const data = await response.json();
          console.log('Chart data:', data);
          setChartData(data);
        }
      } catch (err) {
        console.error('Error fetching chart data:', err);
      } finally {
        setChartLoading(false);
      }
    };

    fetchChartData();
  }, []);

  return (
    <WeeklySignalsTable data={data} chartData={chartData} chartLoading={chartLoading} />
  );
}
