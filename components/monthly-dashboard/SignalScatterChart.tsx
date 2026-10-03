'use client';

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { formatCurrency } from '@/lib/formatters';

interface Signal {
  date: string;
  return: number | null;
  invested: number;
  ticker: string;
  status: 'closed-profit' | 'closed-loss' | 'open-profit' | 'open-loss';
}

interface ChartData {
  date: number; // milliseconds
  dateLabel: string;
  return: number;
  size: number; // For bubble size
  ticker: string;
  invested: number;
  status: string;
  fill: string;
}

interface Props {
  signals: Signal[];
}

const statusColors: Record<string, string> = {
  'closed-profit': 'var(--green)',
  'closed-loss': '#E24B4A',
  'open-profit': 'var(--teal)',
  'open-loss': '#FF9B9B',
};

const statusLabels: Record<string, string> = {
  'closed-profit': 'Closed (Profit)',
  'closed-loss': 'Closed (Loss)',
  'open-profit': 'Open (Profit)',
  'open-loss': 'Open (Loss)',
};

export function SignalScatterChart({ signals }: Props) {
  if (!signals || signals.length === 0) {
    return null;
  }

  const chartData: ChartData[] = signals
    .filter(s => s.return !== null && s.date)
    .map(s => ({
      date: new Date(s.date).getTime(),
      dateLabel: new Date(s.date).toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
      }),
      return: s.return!,
      size: Math.min(Math.max(s.invested / 100, 50), 400), // Clamp bubble size
      ticker: s.ticker,
      invested: s.invested,
      status: s.status,
      fill: statusColors[s.status],
    }))
    .sort((a, b) => a.date - b.date);

  if (chartData.length === 0) {
    return null;
  }

  const minDate = Math.min(...chartData.map(d => d.date));
  const maxDate = Math.max(...chartData.map(d => d.date));

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
          Signal Scatter
        </h3>
        <p
          style={{
            fontSize: '10px',
            color: 'var(--text-3)',
            margin: 0,
            lineHeight: '1.4',
          }}
        >
          Entry date vs return, bubble size = capital. Closed/open by color.
        </p>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            type="number"
            dataKey="date"
            domain={[minDate, maxDate]}
            tickFormatter={(value) => {
              const d = new Date(value);
              return d.toLocaleDateString('en-US', {
                month: 'short',
                year: '2-digit',
              });
            }}
            tick={{ fontSize: 10, fill: 'var(--text-2)' }}
          />
          <YAxis
            type="number"
            dataKey="return"
            label={{
              value: 'Current Return (%)',
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
              fontSize: '11px',
            }}
            cursor={{ strokeDasharray: '3 3' }}
            content={({ payload }) => {
              if (!payload || !payload[0]) return null;
              const data = payload[0].payload as ChartData;
              return (
                <div
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                  }}
                >
                  <div style={{ fontWeight: '700', marginBottom: '4px' }}>
                    {data.ticker}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>
                    Invested: {formatCurrency(data.invested)}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: data.return >= 0 ? 'var(--green)' : '#E24B4A',
                      fontWeight: '600',
                    }}
                  >
                    Return: {data.return >= 0 ? '+' : ''}{data.return.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                    Entry: {data.dateLabel}
                  </div>
                </div>
              );
            }}
          />
          <ReferenceLine y={0} stroke="var(--border)" />
          <Legend />

          {Object.entries(statusLabels).map(([statusKey, label]) => (
            <Scatter
              key={statusKey}
              name={label}
              data={chartData.filter(d => d.status === statusKey)}
              fill={statusColors[statusKey]}
              shape="circle"
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
