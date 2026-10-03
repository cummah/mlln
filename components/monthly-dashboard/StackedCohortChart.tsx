'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Line,
} from 'recharts';
import type { CohortStats } from '@/lib/monthly-dashboard-utils';

interface ChartData {
  period: string;
  closedProfit: number;
  closedLoss: number;
  openProfit: number;
  openLoss: number;
  totalSignals: number;
  medianReturn: number | null;
  opacity: number;
}

interface Props {
  cohorts: Map<string, CohortStats>;
}

export function StackedCohortChart({ cohorts }: Props) {
  if (!cohorts || cohorts.size === 0) {
    return null;
  }

  const chartData: ChartData[] = Array.from(cohorts.values())
    .sort((a, b) => new Date(a.period).getTime() - new Date(b.period).getTime())
    .map(c => {
      const closedProfit = c.closedCount > 0
        ? c.closedCount - (c.closedProfit < 0 ? Math.abs(c.closedProfit) : 0)
        : 0;
      const closedLoss = c.closedCount > 0
        ? Math.max(0, -c.closedProfit)
        : 0;
      const openProfit = c.openCount > 0
        ? c.openCount - (c.openProfit < 0 ? Math.abs(c.openProfit) : 0)
        : 0;
      const openLoss = c.openCount > 0
        ? Math.max(0, -c.openProfit)
        : 0;

      return {
        period: new Date(c.period + '-01').toLocaleDateString('en-US', {
          month: 'short',
          year: '2-digit',
        }),
        closedProfit,
        closedLoss,
        openProfit,
        openLoss,
        totalSignals: c.signalCount,
        medianReturn: c.medianReturn,
        opacity: c.isMature ? 1 : 0.5,
      };
    });

  if (chartData.length === 0) {
    return null;
  }

  const maxSignals = Math.max(...chartData.map(d => d.totalSignals), 10);

  return (
    <div
      style={{
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border-elevated)',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: 'var(--inset-top), var(--shadow-md)',
      }}
    >
      <div style={{ marginBottom: '12px' }}>
        <h3
          style={{
            fontSize: '12px',
            fontWeight: '700',
            color: 'var(--text)',
            margin: '0 0 2px 0',
            letterSpacing: '-0.3px',
          }}
        >
          Monthly Cohorts
        </h3>
        <p
          style={{
            fontSize: '10px',
            color: 'var(--text-3)',
            margin: 0,
            lineHeight: '1.4',
          }}
        >
          Status breakdown by month, median line. Recent faded.
        </p>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11, fill: 'var(--text-2)' }}
          />
          <YAxis
            yAxisId="left"
            label={{ value: 'Signal Count', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
            tick={{ fontSize: 11, fill: 'var(--text-2)' }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            label={{ value: 'Median Return (%)', angle: 90, position: 'insideRight', style: { fontSize: 11 } }}
            tick={{ fontSize: 11, fill: 'var(--text-2)' }}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '8px 12px',
            }}
            formatter={(value: any) =>
              typeof value === 'number' ? value.toFixed(1) : value
            }
          />
          <Legend />
          <ReferenceLine yAxisId="right" y={0} stroke="var(--border)" />

          <Bar
            yAxisId="left"
            dataKey="closedProfit"
            stackId="status"
            fill="var(--green)"
            name="Closed (Profit)"
          />
          <Bar
            yAxisId="left"
            dataKey="closedLoss"
            stackId="status"
            fill="#E24B4A"
            name="Closed (Loss)"
          />
          <Bar
            yAxisId="left"
            dataKey="openProfit"
            stackId="status"
            fill="var(--teal)"
            name="Open (Profit)"
          />
          <Bar
            yAxisId="left"
            dataKey="openLoss"
            stackId="status"
            fill="#FF9B9B"
            name="Open (Loss)"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="medianReturn"
            stroke="var(--text)"
            strokeWidth={2}
            name="Median Return %"
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
