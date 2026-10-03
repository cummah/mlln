'use client';

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Bar,
} from 'recharts';
import { formatCurrency } from '@/lib/formatters';
import type { DrawdownPoint } from '@/lib/monthly-dashboard-utils';

interface Props {
  bhCurve: DrawdownPoint[];
  soldCurve: DrawdownPoint[];
  maxDdBh: number;
  maxDdSold: number;
}

interface ChartPoint extends DrawdownPoint {
  dateLabel: string;
  soldValue?: number;
  soldInvested?: number;
}

export function EquityCurveChart({
  bhCurve,
  soldCurve,
  maxDdBh,
  maxDdSold,
}: Props) {
  if (!bhCurve || bhCurve.length === 0) {
    return null;
  }

  // Prepare equity data with date labels
  const equityData: ChartPoint[] = bhCurve.map((point, idx) => ({
    ...point,
    dateLabel: new Date(point.date).toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
    }),
    soldValue: soldCurve[idx]?.cumulativeValue ?? point.cumulativeValue,
    soldInvested: soldCurve[idx]?.cumulativeInvested ?? point.cumulativeInvested,
  }));

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
          Equity Curve & Drawdown
        </h3>
        <p
          style={{
            fontSize: '10px',
            color: 'var(--text-3)',
            margin: 0,
            lineHeight: '1.4',
          }}
        >
          Buy & Hold {maxDdBh.toFixed(1)}% DD vs Sold {maxDdSold.toFixed(1)}%
        </p>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={equityData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 10, fill: 'var(--text-2)' }}
            interval={Math.floor(equityData.length / 6)}
          />
          <YAxis
            yAxisId="left"
            label={{
              value: 'Portfolio Value (£)',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 11 },
            }}
            tick={{ fontSize: 10, fill: 'var(--text-2)' }}
            tickFormatter={(value) => `£${(value / 1000).toFixed(0)}k`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            label={{
              value: 'Drawdown (%)',
              angle: 90,
              position: 'insideRight',
              style: { fontSize: 11 },
            }}
            tick={{ fontSize: 10, fill: 'var(--text-2)' }}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '11px',
            }}
            formatter={(value: any) => {
              if (typeof value === 'number' && Math.abs(value) > 100) {
                return formatCurrency(value);
              }
              return typeof value === 'number' ? value.toFixed(1) : value;
            }}
            labelFormatter={(label) => `${label}`}
          />
          <Legend />

          {/* Equity lines */}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="cumulativeValue"
            stroke="var(--green)"
            strokeWidth={2}
            name="Buy & Hold Value"
            isAnimationActive={false}
            dot={false}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="soldValue"
            stroke="var(--teal)"
            strokeWidth={2}
            name="Sold at Exit Score Value"
            isAnimationActive={false}
            dot={false}
          />

          {/* Drawdown as area */}
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="drawdown"
            fill="#FF6B6B"
            stroke="none"
            fillOpacity={0.2}
            name="Drawdown %"
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginTop: '16px',
          fontSize: '12px',
        }}
      >
        <div style={{ padding: '12px', background: 'var(--surface)', borderRadius: '6px' }}>
          <div style={{ color: 'var(--text-2)', marginBottom: '4px' }}>
            Buy & Hold
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--green)', marginBottom: '4px' }}>
            {formatCurrency(
              equityData[equityData.length - 1]?.cumulativeValue ?? 0
            )}
          </div>
          <div style={{ color: 'var(--text-3)' }}>
            Max Drawdown: {maxDdBh.toFixed(1)}%
          </div>
        </div>
        <div style={{ padding: '12px', background: 'var(--surface)', borderRadius: '6px' }}>
          <div style={{ color: 'var(--text-2)', marginBottom: '4px' }}>
            Sold at Exit Score
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--teal)', marginBottom: '4px' }}>
            {formatCurrency(
              equityData[equityData.length - 1]?.soldValue ?? 0
            )}
          </div>
          <div style={{ color: 'var(--text-3)' }}>
            Max Drawdown: {maxDdSold.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
}
