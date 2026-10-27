'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/formatters';
import type { Frequency } from '@/lib/portfolio-aggregate';
import type { Period } from '@/types';

interface ChartRowData {
  period: Period;
  cadence: Frequency;
  stdInvested: number;
  stdValue: number;
  enhInvested: number;
  enhValue: number;
}

const COLORS = {
  stdInvested: '#4a6fa5',
  stdValue: '#7e9ab5',
  enhInvested: '#0d9b84',
  enhValue: '#0fa38b',
};

export function InvestedValueChart({ data }: { data: ChartRowData[] }) {
  // Sort by period (1y, 3y, 5y) then by cadence (weekly, monthly)
  const periodOrder: Record<string, number> = { '1y': 0, '3y': 1, '5y': 2 };
  const sortedData = [...data].sort((a, b) => {
    const periodDiff = periodOrder[a.period] - periodOrder[b.period];
    if (periodDiff !== 0) return periodDiff;
    return a.cadence === 'weekly' ? -1 : 1; // weekly before monthly
  });

  // Transform data for Recharts: group by window with both strategies
  const chartData = sortedData.map((row) => {
    const label = `${row.period === '1y' ? '1Y' : row.period === '3y' ? '3Y' : '5Y'} ${row.cadence === 'weekly' ? 'W' : 'M'}`;
    return {
      label,
      'Std Invested': row.stdInvested,
      'Std Value': row.stdValue,
      'Enh Invested': row.enhInvested,
      'Enh Value': row.enhValue,
    };
  });

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          backgroundColor: '#172b40',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '4px',
          padding: '8px 12px',
          fontSize: '12px',
        }}>
          <div style={{ color: 'var(--text)', fontWeight: 600, marginBottom: '6px' }}>
            {data.label}
          </div>
          {payload.map((entry: any) => (
            <div key={entry.dataKey} style={{ color: entry.color, marginBottom: '2px' }}>
              {entry.name}: {formatCurrency(entry.value)}
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 8, right: 20, left: 0, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: 'var(--text-2)', fontSize: 9 }}
          axisLine={{ stroke: 'var(--border)' }}
          angle={0}
          height={30}
        />
        <YAxis
          tick={{ fill: 'var(--text-2)', fontSize: 11 }}
          axisLine={{ stroke: 'var(--border)' }}
          tickFormatter={(value) => formatCurrency(value)}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#172b40', opacity: 0.5 }} />
        <Legend
          verticalAlign="top"
          height={30}
          wrapperStyle={{ fontSize: '11px' }}
          iconType="square"
        />
        <Bar dataKey="Std Invested" stackId="std" fill={COLORS.stdInvested} />
        <Bar dataKey="Std Value" stackId="std" fill={COLORS.stdValue} />
        <Bar dataKey="Enh Invested" stackId="enh" fill={COLORS.enhInvested} />
        <Bar dataKey="Enh Value" stackId="enh" fill={COLORS.enhValue} />
      </BarChart>
    </ResponsiveContainer>
  );
}
