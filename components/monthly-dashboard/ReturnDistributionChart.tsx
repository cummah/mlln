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
} from 'recharts';

interface ChartData {
  bucket: string;
  closedCount: number;
  openCount: number;
  total: number;
}

interface Props {
  data: { bucket: string; closedCount: number; openCount: number }[];
}

export function ReturnDistributionChart({ data }: Props) {
  if (!data || data.length === 0) {
    return null;
  }

  const chartData: ChartData[] = data.map(d => ({
    ...d,
    total: d.closedCount + d.openCount,
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
          Return Distribution
        </h3>
        <p
          style={{
            fontSize: '10px',
            color: 'var(--text-3)',
            margin: 0,
            lineHeight: '1.4',
          }}
        >
          Frequency by return bucket, median vs mean gap.
        </p>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="bucket"
            tick={{ fontSize: 10, fill: 'var(--text-2)' }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            label={{
              value: 'Signal Count',
              angle: -90,
              position: 'insideLeft',
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
            }}
          />
          <Legend />
          <ReferenceLine x="0% to 5%" stroke="var(--border)" />

          <Bar
            dataKey="closedCount"
            stackId="status"
            fill="var(--green)"
            name="Closed"
          />
          <Bar
            dataKey="openCount"
            stackId="status"
            fill="var(--teal)"
            name="Open"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
